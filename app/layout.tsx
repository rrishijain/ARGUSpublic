import type {Metadata} from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import './globals.css';
import './student.css';
import './experience.css';
export const metadata:Metadata={title:'ARGUS — Your personal command centre',description:'Your goals, knowledge and work, brought together. An adaptable local command centre.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
