import {AppProvider} from "../app/components/AppContext";
import Header from "../app/components/layout/Header";
import AdminOrderNotifications from "../app/components/AdminOrderNotifications";
import { Roboto } from 'next/font/google'
import './globals.css'
import {Toaster} from "react-hot-toast";

const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'] })

export const metadata = {
  title: 'ST PIZZA',
  description: 'Order delicious pizza online',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={roboto.className}>
        <main className="max-w-4xl mx-auto p-4">
          <AppProvider>
            <Toaster />
            <AdminOrderNotifications />
            <Header />
            {children}
            <footer className="border-t p-8 text-center text-gray-500 mt-16">
              &copy; 2025 All rights reserved
            </footer>
          </AppProvider>
        </main>
      </body>
    </html>
  )
}