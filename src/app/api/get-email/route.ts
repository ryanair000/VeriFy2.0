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

  for (let i = 1; i <= 5; i++) {
    const user = process.env[`EMAIL_${i}`];
    const password = process.env[`APP_PASSWORD_${i}`];

    if (!user || !password) {
      console.log(`Skipping account ${i} due to missing credentials.`);
      continue; // Skip to the next account if credentials aren't set
    }

    console.log(`Attempting to connect with account ${i}: ${user}`);

    const imapConfig: imaps.ImapSimpleOptions = {
      imap: {
        user: user,
        password: password,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: {
          rejectUnauthorized: false,
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

      const messagesMetadata = await connection.search(searchCriteria, {
        bodies: ['HEADER.FIELDS (DATE)'],
        struct: true
      });

      if (messagesMetadata && messagesMetadata.length > 0) {
        console.log(`Found ${messagesMetadata.length} matching messages for user ${user}.`);

        messagesMetadata.sort((a, b) => {
          const dateA = new Date(a.attributes.date || 0).getTime();
          const dateB = new Date(b.attributes.date || 0).getTime();
          return dateB - dateA;
        });

        const latestMessageMeta = messagesMetadata[0];
        const latestMessageUid = latestMessageMeta.attributes.uid;

        interface FetchOptions {
          bodies: string[];
          struct: boolean;
          markSeen: boolean;
        }

        const fullFetchOptions: FetchOptions = { bodies: [''], struct: true, markSeen: false };
        const messages = await connection.search([['UID', latestMessageUid.toString()]], fullFetchOptions);

        if (messages && messages.length > 0) {
          const message = messages[0];
          interface MessagePart {
            which: string;
            body?: string;
          }
          const fullMessagePart = message.parts.find((part: MessagePart) => part.which === '');

          if (fullMessagePart && fullMessagePart.body) {
            const rawEmail = fullMessagePart.body;
            const parsedEmail: ParsedMail = await simpleParser(rawEmail);
            const emailHtml = parsedEmail.html || `<pre>${parsedEmail.textAsHtml || parsedEmail.text}</pre>`;

            return NextResponse.json({
              email: {
                from: parsedEmail.from?.text,
                subject: parsedEmail.subject,
                date: parsedEmail.date,
                html: emailHtml,
              },
              message: null
            });
          }
        }
      }
    } catch (e: unknown) {
      const error = e as Error;
      console.error(`Error with account ${user}:`, error.message);
      // Don't return, just log and continue to the next account
    } finally {
      if (connection && connection.imap && connection.imap.state !== 'disconnected') {
        try {
          await connection.end();
          console.log(`IMAP connection for ${user} closed.`);
        } catch (endError) {
          console.error('Error closing IMAP connection:', endError);
        }
      }
    }
  }

  // If the loop completes without finding an email
  return NextResponse.json({ email: null, message: `No recent emails with the term "${search}" were found across all accounts. You can try sending a new code and refreshing again.` });
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