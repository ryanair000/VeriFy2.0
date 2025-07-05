'use client';

import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';

// Define the structure of the email object we expect from the API
interface Email {
  from?: string;
  subject?: string;
  date?: string;
  html: string;
}

// -- Reusable SVG Icons --

const FetchIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const MailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mr-2 text-indigo-600">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);

const SuccessIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-green-600">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-blue-600">
    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
  </svg>
);

const ErrorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const HelpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-400 hover:text-indigo-600 transition">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
  </svg>
);


// -- UI Components --

const EmailSkeleton = () => (
  <div className="mt-8 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
    <div className="h-6 bg-gray-300 rounded w-3/4 mb-4"></div>
    <div className="space-y-3 mt-6 border-t pt-4">
      <div className="h-2 bg-gray-200 rounded w-full"></div>
      <div className="h-2 bg-gray-200 rounded w-full"></div>
      <div className="h-2 bg-gray-200 rounded w-5/6"></div>
      <div className="h-2 bg-gray-200 rounded w-3/4"></div>
    </div>
  </div>
);

const EmailView = ({ email }: { email: Email }) => {
  const displayDate = email.date ? new Date(email.date).toLocaleString() : 'No date';
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const resizeIframe = () => {
    if (iframeRef.current) {
      iframeRef.current.style.height = `${iframeRef.current.contentWindow?.document.body.scrollHeight || 500}px`;
    }
  };

  return (
    <div className="mt-8">
      <div className="p-4 rounded-lg border bg-white shadow-sm">
        <header className="pb-4 border-b">
          <h3 className="font-semibold text-lg text-gray-800">{email.subject || 'No Subject'}</h3>
          <p className="text-sm text-gray-600">
            <span className="font-medium">From:</span> {email.from || 'No Sender'}
          </p>
          <p className="text-sm text-gray-500">
            <span className="font-medium">Date:</span> {displayDate}
          </p>
        </header>
        <iframe 
          ref={iframeRef}
          srcDoc={email.html}
          onLoad={resizeIframe}
          className="pt-4 w-full border-0"
          title={email.subject || 'Email Content'}
        />
      </div>
    </div>
  );
};


export default function HomePage() {
  const [emailInput, setEmailInput] = useState('');
  const [retrievedEmail, setRetrievedEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [remainingTurns, setRemainingTurns] = useState<number | null>(null);

  useEffect(() => {
    toast.success('Welcome to VeriFy!');
    // Use a timeout to display the second toast shortly after the first
    setTimeout(() => {
      toast('You have 3 refresh attempts.', {
        icon: 'ℹ️',
      });
    }, 1000);
  }, []);

  const handleFetchEmail = async () => {
    setIsLoading(true);
    setRetrievedEmail(null);

    // Use a toast as a loading indicator
    const toastId = toast.loading('Fetching your email...');

    try {
      const response = await fetch('/api/get-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          user: emailInput, 
          search: 'code' 
        }), 
      });

      // Update remaining turns after every request
      const remaining = response.headers.get('X-RateLimit-Remaining');
      if (remaining) {
        setRemainingTurns(Number(remaining));
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'An unknown error occurred.');
      }

      const data = await response.json();
      setRetrievedEmail(data.email);

      if (data.email) {
        toast.success('Email found!', { id: toastId });
      } else {
        toast.error('No recent code email was found.', { id: toastId });
      }
    } catch (err: unknown) {
      const error = err as Error;
      // Display the error message in a toast
      toast.error(error.message, { id: toastId });
      setRetrievedEmail(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#374151',
            color: '#fff',
          },
        }}
      />

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <MailIcon />
              <div>
                <h1 className="text-2xl font-bold text-indigo-600">VeriFy</h1>
                <p className="text-sm text-gray-500">Your Email Verification Buddy</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-2xl relative">
          
          {remainingTurns !== null && (
            <div className="absolute top-4 right-4 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              Turns Left: {remainingTurns}
            </div>
          )}

          <h2 className="text-xl font-semibold text-gray-700 mb-6 text-center">
            Enter Mail and Select Refresh Mail
          </h2>
          
          <div className="space-y-4 mb-6">
            <div>
              <label htmlFor="emailInput" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="emailInput"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="user@gmail.com"
                autoComplete="email"
              />
            </div>
          </div>

          <button
            onClick={handleFetchEmail}
            disabled={isLoading || !emailInput}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
          >
            <FetchIcon />
            {isLoading ? 'Fetching...' : 'Refresh Mail'}
          </button>

          {isLoading && <EmailSkeleton />}

          {retrievedEmail && !isLoading && (
            <EmailView email={retrievedEmail} />
          )}
          
          {!isLoading && !retrievedEmail && (
            <div className="mt-8 p-6 text-center text-gray-400">
              Your latest email with a verification code will appear here.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
