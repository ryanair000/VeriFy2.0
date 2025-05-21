import { NextRequest, NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser'; // RE-ADD these imports
// import { Readable } from 'stream'; // REMOVED: Readable is unused

// !!IMPORTANT!!
// Create a .env.local file in your project root and add these:
// IMAP_USER=your_gmail_address@gmail.com
// IMAP_PASSWORD=your_gmail_app_password
// GMAIL_ADDRESS_TO_SEARCH=email_account_to_search@gmail.com (can be same as IMAP_USER)

const IMAP_USER_EMAIL = process.env.IMAP_USER;
const IMAP_APP_PASSWORD = process.env.IMAP_PASSWORD;
// const GMAIL_TARGET_ACCOUNT = process.env.GMAIL_ADDRESS_TO_SEARCH; // This is the account we are searching IN.

const imapConfig: imaps.ImapSimpleOptions = {
  imap: {
    user: IMAP_USER_EMAIL || '',
    password: IMAP_APP_PASSWORD || '',
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    authTimeout: 10000, // Increased timeout
    tlsOptions: {
      rejectUnauthorized: false, // Necessary for some environments, consider if this is acceptable for your security posture
    },
  },
  // debug: console.log // Uncomment for detailed IMAP logs
};

// Helper function to format date for IMAP SINCE criterion
function formatDateForIMAP(date: Date): string {
  const day = date.getDate();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  if (!IMAP_USER_EMAIL || !IMAP_APP_PASSWORD) {
    console.error('IMAP credentials are not set in environment variables.');
    return NextResponse.json(
      { error: 'Server configuration error: IMAP credentials missing.' },
      { status: 500 }
    );
  }
  
  let connection: imaps.ImapSimple | null = null;

  try {
    connection = await imaps.connect(imapConfig);
    console.log('Successfully connected to IMAP server.');

    await connection.openBox('INBOX');
    console.log('Opened INBOX.');

    // Calculate the date for 15 minutes ago
    const fifteenMinutesAgo = new Date();
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
    // IMAP SINCE criterion expects date in "DD-Mon-YYYY" format or a Date object
    // Using a Date object is generally safer with node-imap / imap-simple
    // UPDATE: Formatting to string as Date object caused issues with SINCE argument count.
    const formattedDateForSearch = formatDateForIMAP(fifteenMinutesAgo);

    // Search criteria: TEXT 'netflix' AND SINCE 15 minutes ago
    const searchCriteria = [
      ['TEXT', 'netflix'],
      ['SINCE', formattedDateForSearch] // Group SINCE and its value
    ];

    console.log('Searching for "netflix" emails in the last 15 minutes. Criteria:', searchCriteria);

    // Fetch headers first to get UIDs and exact dates for sorting
    const messagesMetadata = await connection.search(searchCriteria, {
      bodies: ['HEADER.FIELDS (DATE)'],
      struct: true
    });

    if (!messagesMetadata) {
      console.warn('connection.search for recent "netflix" UIDs returned null.');
      return NextResponse.json({ emailContent: null, message: 'No Netflix emails found in the last 15 mins (search returned null).' });
    }

    console.log(`Found ${messagesMetadata.length} "netflix" messages in the last 15 mins (metadata).`);

    if (messagesMetadata.length === 0) {
      return NextResponse.json({ emailContent: null, message: 'No Netflix emails found in the last 15 minutes.' });
    }

    // Sort to find the most recent one (though SINCE should ideally limit this)
    messagesMetadata.sort((a, b) => {
      const dateA = new Date(a.attributes.date || 0).getTime();
      const dateB = new Date(b.attributes.date || 0).getTime();
      return dateB - dateA; // Newest first
    });

    const latestMessageMeta = messagesMetadata[0];
    const latestMessageUid = latestMessageMeta.attributes.uid;
    console.log(`Latest "netflix" email in last 15 mins is UID: ${latestMessageUid}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullFetchOptions: any = { bodies: [''], struct: true, markSeen: false };
    let emailHtml: string | null = null;
    let finalMessage = 'Email content should appear here.'; // Default message if parsing fails

    try {
      console.log(`Fetching full content for UID: ${latestMessageUid}`);
      // Use connection.fetch() for fetching by UID, as it's more direct
      const messages = await connection.fetch([latestMessageUid.toString()], fullFetchOptions);
      
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