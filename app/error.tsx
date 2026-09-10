'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main style={{padding:40}}><h1>ARGUS needs a moment.</h1><p>Your local information is preserved. Try again, or run npm run doctor.</p><button onClick={reset}>Try again</button></main>;}
