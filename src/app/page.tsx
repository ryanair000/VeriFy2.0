'use client';

import { useState } from 'react';

// Simple SVG icon for logout (replace with a proper icon library if available)
const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
  </svg>
);

// Simple SVG icon for fetch (replace with a proper icon library if available)
const FetchIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

// Simple SVG Mail Icon
const MailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mr-2 text-indigo-600">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);

export default function HomePage() {
  const [emailInput, setEmailInput] = useState('');
  const [searchInput, setSearchInput] = useState('netflix');
  const [retrievedEmail, setRetrievedEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleFetchEmail = async () => {
    setIsLoading(true);
    setError(null);
    setRetrievedEmail(null);
    setInfoMessage(null);

    try {
      const response = await fetch('/api/get-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          user: emailInput, 
          search: searchInput 
        }), 
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch email');
      }

      if (data.message) {
        setInfoMessage(data.message);
      }
      setRetrievedEmail(data.emailContent);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'An unexpected error occurred.');
      setRetrievedEmail(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
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
            <button 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400"
            >
              <LogoutIcon />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-2xl">
          <h2 className="text-xl font-semibold text-gray-700 mb-6 text-center">
            Enter your email credentials to fetch emails
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

            <div>
              <label htmlFor="searchInput" className="block text-sm font-medium text-gray-700 mb-1">
                Search Term
              </label>
              <input
                type="text"
                id="searchInput"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g., 'netflix' or 'FROM &quot;someone@example.com&quot;'"
              />
            </div>
          </div>

          <button
            onClick={handleFetchEmail}
            disabled={isLoading || !emailInput || !searchInput}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
          >
            <FetchIcon />
            {isLoading ? 'Fetching...' : `Fetch Latest "${searchInput}" Email`}
          </button>

          {error && (
            <div className="mt-6 p-3 text-sm text-red-700 bg-red-100 rounded-lg border border-red-300" role="alert">
              <span className="font-medium">Error:</span> {error}
            </div>
          )}

          {infoMessage && !retrievedEmail && !error && (
            <div className="mt-6 p-3 text-sm text-blue-700 bg-blue-100 rounded-lg border border-blue-300" role="status">
              {infoMessage}
            </div>
          )}

          {retrievedEmail && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-2 text-gray-800">Retrieved Email:</h3>
              <div className="bg-gray-50 p-4 rounded-lg shadow-inner prose prose-sm max-w-none overflow-x-auto border border-gray-200" dangerouslySetInnerHTML={{ __html: retrievedEmail }} />
            </div>
          )}
          
          {!isLoading && !error && !infoMessage && !retrievedEmail && (
            <div className="mt-8 p-6 text-center text-gray-400">
              Your latest email for the search term "{searchInput}" will appear here.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
