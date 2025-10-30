import { NextRequest, NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';

// Email configuration and IMAP settings

function formatDateForIMAP(date: Date): string {
  const day = date.getDate();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export async function POST(request: NextRequest) {

  const body = await request.json();
  const { search } = body;

  if (!search) {
    return NextResponse.json(
      { error: 'Missing search term in request.' },
      { status: 400 }
    );
  }

  // Use the first email configuration from environment variables
  const user = process.env.EMAIL_1;
  const password = process.env.APP_PASSWORD_1;

  if (!user || !password) {
    return NextResponse.json(
      { error: 'Server email configuration is missing. Please check EMAIL_1 and APP_PASSWORD_1 in .env.local' },
      { status: 500 }
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

    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    const formattedDateForSearch = formatDateForIMAP(fiveMinutesAgo);

    const searchCriteria = [
      ['TEXT', search],
      ['SINCE', formattedDateForSearch]
    ];

    console.log(`Searching for "${search}" emails in the last 5 minutes for user ${user}. Criteria:`, searchCriteria);

    const messagesMetadata = await connection.search(searchCriteria, {
      bodies: ['HEADER.FIELDS (DATE)'],
      struct: true
    });

    if (!messagesMetadata || messagesMetadata.length === 0) {
      return NextResponse.json({ email: null, message: `No recent emails with the term "${search}" were found. You can try sending a new code and refreshing again.` });
    }

    console.log(`Found ${messagesMetadata.length} "${search}" messages in the last 15 mins (metadata) for user ${user}.`);

    // Sort to find the most recent one
    messagesMetadata.sort((a, b) => {
      const dateA = new Date(a.attributes.date || 0).getTime();
      const dateB = new Date(b.attributes.date || 0).getTime();
      return dateB - dateA; // Newest first
    });

    const latestMessageMeta = messagesMetadata[0];
    const latestMessageUid = latestMessageMeta.attributes.uid;
    console.log(`Latest "${search}" email in last 15 mins is UID: ${latestMessageUid}`);

    // Define a specific type for fetch options to avoid `any`
    interface FetchOptions {
      bodies: string[];
      struct: boolean;
      markSeen: boolean;
    }

    const fullFetchOptions: FetchOptions = { bodies: [''], struct: true, markSeen: false };
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
        interface MessagePart {
          which: string;
          body?: string;
        }
        const fullMessagePart = message.parts.find((part: MessagePart) => part.which === '');
        
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
          }

          if (emailHtml) {
            return NextResponse.json({
              email: {
                from: parsedEmail.from?.text,
                subject: parsedEmail.subject,
                date: parsedEmail.date,
                html: emailHtml,
              },
              message: null 
            });
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
    
    return NextResponse.json({ email: null, message: emailHtml ? null : finalMessage });

  } catch (e: unknown) {
    const error = e as Error;
    console.error('IMAP connection or processing error:', error);
    let errorMessage = 'Failed to fetch emails.';
    if (error.message) {
        errorMessage = error.message;
    }
    if (typeof e === 'object' && e !== null && 'source' in e && e.source === 'authentication') {
        errorMessage = 'Authentication failed. Please double-check that the App Password for this account is correct and has not been revoked.';
    }
    return NextResponse.json({ error: errorMessage, email: null }, { status: 500 });
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