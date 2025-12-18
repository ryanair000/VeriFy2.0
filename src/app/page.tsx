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
    <div className="p-6 rounded-xl border bg-white shadow-lg text-center">
      <div className="h-6 bg-gray-200 rounded w-40 mx-auto mb-4"></div>
      <div className="h-16 bg-gray-300 rounded w-48 mx-auto my-4"></div>
      <div className="h-4 bg-gray-100 rounded w-32 mx-auto"></div>
    </div>
  </div>
);

const EmailView = ({ email }: { email: Email }) => {
  return (
    <div className="mt-8">
      <div className="p-6 rounded-xl border bg-white shadow-lg">
        {/* Email Info Header */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">From:</span> {email.from}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Subject:</span> {email.subject}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Date:</span> {new Date(email.date || '').toLocaleString()}
          </p>
        </div>

        {/* Email Content */}
        <div className="border rounded-lg overflow-hidden">
          <iframe
            title="Email Content"
            srcDoc={email.html}
            className="w-full h-[500px]"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      </div>
    </div>
  );
};


export default function HomePage() {
  const [retrievedEmail, setRetrievedEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    toast.success('Welcome to VeriFy!');
  }, []);

  const handleFetchEmail = async () => {
    setIsLoading(true);
    setRetrievedEmail(null);

    // Use a toast as a loading indicator
    const toastId = toast.loading('Fetching your email...');

    try {
      // First, try to find emails with "code"
      let response = await fetch('/api/get-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          search: 'code' 
        }), 
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'An unknown error occurred.');
      }

      let data = await response.json();
      
      // If no "code" email found, try searching for "Amazon"
      if (!data.email) {
        toast.loading('No code email found. Searching for Amazon emails...', { id: toastId });
        
        response = await fetch('/api/get-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            search: 'Amazon' 
          }), 
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'An unknown error occurred.');
        }

        data = await response.json();
      }

      setRetrievedEmail(data.email);

      if (data.email) {
        toast.success('Email found!', { id: toastId });
      } else {
        toast.error('No recent code or Amazon email was found.', { id: toastId });
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
          
          <h2 className="text-xl font-semibold text-gray-700 mb-6 text-center">
            Please click here to receive the latest code
          </h2>
          
          <button
            onClick={handleFetchEmail}
            disabled={isLoading}
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
            <div className="mt-8 p-8 text-center">
              <div className="inline-block p-4 rounded-full bg-gray-100 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">Your latest verification code will appear here</p>
              <p className="text-sm text-gray-400 mt-2">Click the refresh button above to check for new codes</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
