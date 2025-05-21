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

    // --- New logic to get latest 5 UIDs ---
    console.log('Fetching all UIDs from INBOX to determine the latest emails...');
    const allMessagesMetadata = await connection.search(['ALL'], {
      bodies: [], // We don't need bodies here, just UIDs
      struct: false, // No need for structure
      markSeen: false,
    });
    console.log(`Found ${allMessagesMetadata.length} total messages in INBOX.`);

    if (allMessagesMetadata.length === 0) {
      return NextResponse.json({ emailContent: 'No emails found in INBOX.' });
    }

    // Extract UIDs and sort them to get the most recent ones
    // UIDs are generally increasing, so sorting them descending gives newest first.
    const uids = allMessagesMetadata.map(msg => msg.attributes.uid);
    uids.sort((a, b) => b - a); // Sort UIDs in descending order

    // Take the latest 5 UIDs (or fewer if not enough messages)
    const latestUidsToSearch = uids.slice(0, 5);
    console.log('Will search for "netflix" within these UIDs (latest 5 or fewer):', latestUidsToSearch);

    if (latestUidsToSearch.length === 0) {
      // This case should ideally be covered if allMessagesMetadata.length was 0, but as a safeguard
      return NextResponse.json({ emailContent: 'No emails to search within after filtering for latest UIDs.' });
    }
    
    const uidSearchString = latestUidsToSearch.join(',');
    // --- End of new logic ---

    // Original Netflix search terms criteria structure
    const netflixCriteria = [
      'OR',
      ['OR', ['SUBJECT', 'netflix'], ['BODY', 'netflix']],
      ['TEXT', 'netflix']
    ];

    // Combine UID list with Netflix criteria.
    // This searches for messages that are in the UID list AND match the netflix criteria.
    const combinedSearchCriteria = [uidSearchString, ...netflixCriteria];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchOptions: any = { // Using any for now
      bodies: [''], // Fetch the full raw email source
      struct: true,
      markSeen: false, // Set to true if you want to mark emails as read after fetching
    };

    // Search for messages matching the combined criteria
    console.log('Searching for "netflix" within the latest UIDs using criteria:', combinedSearchCriteria);
    const messages = await connection.search(combinedSearchCriteria, fetchOptions);
    
    // Safeguard against messages being null before accessing length
    if (!messages) {
      console.warn('connection.search returned null, treating as no messages found.');
      return NextResponse.json({ emailContent: 'No "netflix" email found within the latest 5 emails (search returned null).' });
    }

    console.log(`Found ${messages.length} "netflix" messages within the latest UIDs.`);

    if (messages.length === 0) {
      return NextResponse.json({ emailContent: 'No "netflix" email found within the latest 5 emails.' });
    }

    // Get the latest email from the filtered list
    // (Sort by date, as UIDs in 'messages' might not be perfectly date-ordered if multiple matched from the 5)
    let latestMessage = messages[0];
    if (messages.length > 1) {
        messages.sort((a,b) => {
            const dateA = new Date(a.attributes.date || 0).getTime();
            const dateB = new Date(b.attributes.date || 0).getTime();
            return dateB - dateA; // Sort descending, newest first
        });
        latestMessage = messages[0];
    }
    
    const latestMessageUid = latestMessage.attributes.uid;
    console.log('Processing message with UID:', latestMessageUid);

    // When bodies: [''] is used, the full raw message source is in the part with which: ''
    const fullMessagePart = latestMessage.parts.find(part => part.which === '');
    
    if (!fullMessagePart || !fullMessagePart.body) {
        console.error('No full message part (which: \'\') found or body is empty for message UID:', latestMessageUid);
        // Attempt to find 'TEXT' part as a fallback, though it might not be the complete email
        const textPartFallback = latestMessage.parts.find(part => part.which === 'TEXT');
        if (!textPartFallback || !textPartFallback.body) {
            console.error('Fallback to TEXT part also failed or body is empty for message UID:', latestMessageUid);
            return NextResponse.json({ error: 'Email found, but content is missing or in an unexpected format.' }, { status: 500 });
        }
        console.warn('Using TEXT part as fallback for UID:', latestMessageUid);
        const rawEmail = textPartFallback.body;
        
        // Parse the raw email to get HTML content
        const parsedEmail: ParsedMail = await simpleParser(rawEmail);
        let emailHtml = parsedEmail.html || '';

        if (!emailHtml && parsedEmail.text) {
          emailHtml = `<pre style="white-space: pre-wrap; word-wrap: break-word;">${parsedEmail.textAsHtml || parsedEmail.text.replace(/\n/g, '<br>')}</pre>`;
        }
        
        if (!emailHtml) {
            console.log('Email content (HTML or text) is empty after parsing fallback TEXT part for UID:', latestMessageUid);
            return NextResponse.json({ emailContent: 'Email found, but content appears to be empty (from fallback).'});
        }
        
        console.log('Successfully parsed fallback TEXT email, HTML length:', emailHtml.length);
        return NextResponse.json({ emailContent: emailHtml });
    }

    // The body here is the raw email source for the message
    const rawEmail = fullMessagePart.body;

    // Parse the raw email to get HTML content
    const parsedEmail: ParsedMail = await simpleParser(rawEmail);
    
    let emailHtml = parsedEmail.html || '';

    if (!emailHtml && parsedEmail.text) {
      // Fallback to text if HTML is not available
      emailHtml = `<pre style="white-space: pre-wrap; word-wrap: break-word;">${parsedEmail.textAsHtml || parsedEmail.text.replace(/\n/g, '<br>')}</pre>`;
    }
    
    if (!emailHtml) {
        console.log('Email content (HTML or text) is empty after parsing for UID:', latestMessageUid);
        return NextResponse.json({ emailContent: 'Email found, but content appears to be empty.'});
    }
    
    console.log('Successfully parsed email, HTML length:', emailHtml.length);
    return NextResponse.json({ emailContent: emailHtml });

  } catch (e: unknown) { // Changed error: any to e: unknown
    const error = e as Error; // Type assertion
    console.error('IMAP connection or processing error:', error);
    let errorMessage = 'Failed to fetch email.';
    if (error.message) {
        errorMessage = error.message;
    }
    // Check if error has a 'source' property before accessing it
    if (typeof e === 'object' && e !== null && 'source' in e && e.source === 'authentication') {
        errorMessage = 'IMAP Authentication failed. Please check your email and app password in .env.local.';
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
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