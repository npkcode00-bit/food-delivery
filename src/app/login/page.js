'use client'

import {signIn} from "next-auth/react"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"


export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginInProgress, setLoginInprogress] = useState(false)


 async function handleFormSubmit(ev) {
    ev.preventDefault();
    setLoginInprogress(true)
   
   await signIn('credentials', {email, password, callbackUrl: '/'});


    setLoginInprogress(false)
  }


  return (
    <section className="mt-8">


        <h1 className="text-center text-primary text-4xl mb-4">
            Login
        </h1>
        <form className="max-w-xs mx-auto" onSubmit={handleFormSubmit}>
          <input 
            type="email" 
            name="email"
            placeholder="email" 
            value={email}
             disabled={loginInProgress}
            onChange={ev => setEmail(ev.target.value)} 
           
          />

          <input 
            type="password" 
            name="password"
            placeholder="password"
            value={password}
            disabled={loginInProgress}
            onChange={ev => setPassword(ev.target.value)}  
          />
          <button  disabled={loginInProgress} type="submit">Login</button>

           
        

      


        </form>
    </section>
  )
}
