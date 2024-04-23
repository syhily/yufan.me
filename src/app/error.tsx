'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="data-null">
      <div className="my-auto">
        <h1 className="font-number">❌500</h1>
        <div>Oh no, something went wrong... maybe refresh?</div>
      </div>
    </div>
  );
}
