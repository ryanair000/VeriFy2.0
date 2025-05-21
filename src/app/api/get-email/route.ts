import { NextRequest, NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';
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
    // const body = await request.json(); // REMOVED - userEmail from body is not used
    // const userEnteredEmail = body.userEmail; // The email entered in the frontend form - currently not used for search logic

    // if (!userEnteredEmail) {
    //   return NextResponse.json({ error: 'User email is required from frontend' }, { status: 400 });
    // }

    connection = await imaps.connect(imapConfig);
    console.log('Successfully connected to IMAP server.');

    await connection.openBox('INBOX');
    console.log('Opened INBOX.');

    // Search criteria for "netflix"
    const netflixSearchCriteria = [
      'OR',
      ['OR', ['SUBJECT', 'netflix'], ['BODY', 'netflix']],
      ['TEXT', 'netflix']
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchOptions: any = {
      bodies: [''], // Fetch the full raw email source
      struct: true,
      markSeen: false,
    };

    console.log('Searching for all "netflix" emails in INBOX with criteria:', netflixSearchCriteria);
    const allNetflixMessages = await connection.search(netflixSearchCriteria, fetchOptions);

    if (!allNetflixMessages) {
      console.warn('connection.search for "netflix" emails returned null.');
      return NextResponse.json({ emails: [], message: 'No Netflix emails found (search returned null).' });
    }

    console.log(`Found ${allNetflixMessages.length} total "netflix" messages.`);

    if (allNetflixMessages.length === 0) {
      return NextResponse.json({ emails: [], message: 'No Netflix emails found matching criteria.' });
    }

    // Sort all found Netflix messages by date, newest first
    allNetflixMessages.sort((a, b) => {
        const dateA = new Date(a.attributes.date || 0).getTime();
        const dateB = new Date(b.attributes.date || 0).getTime();
        return dateB - dateA;
    });

    // Take the latest 5 (or fewer if not enough)
    const latest5NetflixMessages = allNetflixMessages.slice(0, 5);
    console.log(`Processing the latest ${latest5NetflixMessages.length} "netflix" messages.`);

    const emailContents: string[] = [];

    for (const message of latest5NetflixMessages) {
      const messageUid = message.attributes.uid;
      console.log('Processing message with UID:', messageUid);

      const fullMessagePart = message.parts.find(part => part.which === '');
      
      if (!fullMessagePart || !fullMessagePart.body) {
        console.error('No full message part found or body is empty for UID:', messageUid);
        emailContents.push(`<p>Error: Could not retrieve content for email UID ${messageUid}.</p>`);
        continue; // Skip to next message
      }

      const rawEmail = fullMessagePart.body;
      try {
        const parsedEmail: ParsedMail = await simpleParser(rawEmail);
        let emailHtml = parsedEmail.html || '';

        if (!emailHtml && parsedEmail.text) {
          emailHtml = `<pre style="white-space: pre-wrap; word-wrap: break-word;">${parsedEmail.textAsHtml || parsedEmail.text.replace(/\n/g, '<br>')}</pre>`;
        }
        
        if (!emailHtml) {
          console.log('Email content (HTML or text) is empty after parsing for UID:', messageUid);
          emailContents.push(`<p>Email UID ${messageUid} found, but content appears to be empty.</p>`);
        } else {
          emailContents.push(emailHtml);
        }
      } catch (parseError: unknown) {
        const pError = parseError as Error;
        console.error(`Error parsing email UID ${messageUid}:`, pError);
        emailContents.push(`<p>Error parsing email UID ${messageUid}: ${pError.message}</p>`);
      }
    }
    
    console.log('Successfully processed emails. Returning contents for:', emailContents.length);
    return NextResponse.json({ emails: emailContents });

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
    return NextResponse.json({ error: errorMessage, emails: [] }, { status: 500 });
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