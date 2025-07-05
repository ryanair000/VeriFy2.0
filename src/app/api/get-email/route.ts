import { NextRequest, NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';

// The following environment variables are now deprecated in favor of passing credentials from the client.
// You can remove them from your .env.local file.
// IMAP_USER=your_gmail_address@gmail.com
// IMAP_PASSWORD=your_gmail_app_password

function formatDateForIMAP(date: Date): string {
  const day = date.getDate();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// Helper function to find the corresponding app password from environment variables
function getAppPassword(email: string): string | null {
  let i = 1;
  while (process.env[`EMAIL_${i}`]) {
    if (process.env[`EMAIL_${i}`]?.toLowerCase() === email.toLowerCase()) {
      return process.env[`APP_PASSWORD_${i}`] || null;
    }
    i++;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { user, search } = body;

  if (!user || !search) {
    return NextResponse.json(
      { error: 'Missing user or search term in request.' },
      { status: 400 }
    );
  }

  const password = getAppPassword(user);

  if (!password) {
    return NextResponse.json(
      { error: `App password not found for user: ${user}. Please check your .env.local configuration.` },
      { status: 401 }
    );
  }

  const imapConfig: imaps.ImapSimpleOptions = {
    imap: {
      user: user,
      password: password,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 10000,
      tlsOptions: {
        rejectUnauthorized: false, // WARNING: For development/self-signed certs only. In production, use a valid CA-signed certificate and set this to true.
      },
    },
  };
  
  let connection: imaps.ImapSimple | null = null;

  try {
    connection = await imaps.connect(imapConfig);
    console.log(`Successfully connected to IMAP server for user: ${user}.`);

    await connection.openBox('INBOX');
    console.log('Opened INBOX.');

    const fifteenMinutesAgo = new Date();
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
    const formattedDateForSearch = formatDateForIMAP(fifteenMinutesAgo);

    const searchCriteria = [
      ['TEXT', search],
      ['SINCE', formattedDateForSearch]
    ];

    console.log(`Searching for "${search}" emails in the last 15 minutes for user ${user}. Criteria:`, searchCriteria);

    const messagesMetadata = await connection.search(searchCriteria, {
      bodies: ['HEADER.FIELDS (DATE)'],
      struct: true
    });

    if (!messagesMetadata) {
      console.warn(`connection.search for recent "${search}" UIDs returned null for user ${user}.`);
      return NextResponse.json({ emailContent: null, message: `No "${search}" emails found in the last 15 mins (search returned null).` });
    }

    console.log(`Found ${messagesMetadata.length} "${search}" messages in the last 15 mins (metadata) for user ${user}.`);

    if (messagesMetadata.length === 0) {
      return NextResponse.json({ emailContent: null, message: `No "${search}" emails found in the last 15 minutes.` });
    }

    messagesMetadata.sort((a, b) => {
      const dateA = new Date(a.attributes.date || 0).getTime();
      const dateB = new Date(b.attributes.date || 0).getTime();
      return dateB - dateA; // Newest first
    });

    const latestMessageMeta = messagesMetadata[0];
    const latestMessageUid = latestMessageMeta.attributes.uid;
    console.log(`Latest "${search}" email in last 15 mins is UID: ${latestMessageUid}`);

    const fullFetchOptions: any = { bodies: [''], struct: true, markSeen: false };
    let emailHtml: string | null = null;
    let finalMessage = 'Email content should appear here.'; // Default message if parsing fails

    try {
      console.log(`Fetching full content for UID: ${latestMessageUid}`);
      // Revert to connection.search() as .fetch() is not on ImapSimple type
      const messages = await connection.search([['UID', latestMessageUid.toString()]], fullFetchOptions);
      
      if (!messages || messages.length === 0) {
        console.error(`Could not fetch message details for UID: ${latestMessageUid}`);
        finalMessage = `Error: Could not retrieve details for email UID ${latestMessageUid}.`;
      } else {
        const message = messages[0];
        const fullMessagePart = message.parts.find(part => part.which === '');
        
        if (!fullMessagePart || !fullMessagePart.body) {
          console.error('No full message part found or body is empty for UID:', latestMessageUid);
          finalMessage = `Error: Could not retrieve content for email UID ${latestMessageUid}.`;
        } else {
          const rawEmail = fullMessagePart.body;
          const parsedEmail: ParsedMail = await simpleParser(rawEmail);
          const parsedHtml = parsedEmail.html || '';

          if (!parsedHtml && parsedEmail.text) {
            emailHtml = `<pre style="white-space: pre-wrap; word-wrap: break-word;">${parsedEmail.textAsHtml || parsedEmail.text.replace(/\\n/g, '<br>')}</pre>`;
          } else if (parsedHtml) {
            emailHtml = parsedHtml;
          } else {
            console.log('Email content (HTML or text) is empty after parsing for UID:', latestMessageUid);
            finalMessage = `Email UID ${latestMessageUid} found, but content appears to be empty.`;
          }
        }
      }
    } catch (fetchOrParseError: unknown) {
      const fpError = fetchOrParseError as Error;
      console.error(`Error fetching/parsing email UID ${latestMessageUid}:`, fpError);
      finalMessage = `Error processing email UID ${latestMessageUid}: ${fpError.message}`;
    }
    
    return NextResponse.json({ emailContent: emailHtml, message: emailHtml ? null : finalMessage });

  } catch (e: unknown) {
    const error = e as Error;
    console.error('IMAP connection or processing error:', error);
    let errorMessage = 'Failed to fetch emails.';
    if (error.message) {
        errorMessage = error.message;
    }
    if (typeof e === 'object' && e !== null && 'source' in e && e.source === 'authentication') {
        errorMessage = 'IMAP Authentication failed. Please check your email and app password in .env.local.';
    }
    return NextResponse.json({ error: errorMessage, emailContent: null }, { status: 500 });
  } finally {
    if (connection && connection.imap && connection.imap.state !== 'disconnected') {
      try {
        await connection.end();
        console.log('IMAP connection closed.');
      } catch (endError) {
        console.error('Error closing IMAP connection:', endError);
      }
    }
  }
}

// Note: The crucial part for App Password authentication is missing here with googleapis.
// googleapis primarily uses OAuth2. For App Passwords (which work with username/password style auth for IMAP/SMTP),
// you would typically use a library like `nodemailer` (for sending, but can be adapted for IMAP with other libs)
// or `imap-simple` / `node-imap` for fetching emails.

// If you want to proceed with App Passwords, we have two main options:
// 1. Adapt this code to use an IMAP library. This is the recommended and more robust way for App Passwords.
// 2. Attempt to configure a Service Account with domain-wide delegation to access GMAIL_ADDRESS. This is more complex to set up.

// For the purpose of this example, I've laid out the structure using `googleapis` but highlighted
// that the authentication part needs to be implemented differently for App Passwords.
// A direct call to `gmail.users.messages.list` or `.get` with an App Password won't work
// if the `auth` object isn't correctly configured for that (which `google.auth.OAuth2()` is not, by default for this use case).

// Let's assume for now that you might explore service accounts or switch to an IMAP library.
// If you want to use an IMAP library, I can provide an example for that. 