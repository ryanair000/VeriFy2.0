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
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const resizeIframe = () => {
    if (iframeRef.current) {
      iframeRef.current.style.height = `${iframeRef.current.contentWindow?.document.body.scrollHeight || 500}px`;
    }
  };

  return (
    <div className="mt-8">
      <div className="p-4 rounded-lg border bg-white shadow-sm">
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
