'use client';
import Right from '../icons/Right';

export default function Hero({ insideBox = false }) {
  return (
    <section  className={insideBox ? 'mt-2' : 'relative mt-8'}>
      {/* only show blobs when not inside the outer window */}
      {!insideBox && (
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-12%] h-72 w-72 -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-400 to-blue-600 opacity-30 blur-3xl" />
          <div className="absolute bottom-[-10%] left-10 h-64 w-64 rounded-full bg-gradient-to-br from-rose-400 to-orange-300 opacity-20 blur-3xl" />
          <div className="absolute right-10 top-1/3 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 opacity-20 blur-3xl" />
        </div>
      )}

      {/* if insideBox, no inner card—just content */}
      <div  className={insideBox ? 'mx-auto max-w-2xl' : 'mx-auto max-w-4xl rounded-2xl bg-white/40 px-6 py-10 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur-xl md:px-12 md:py-16'}>
        <h1 className="text-4xl font-semibold leading-tight text-zinc-900 md:text-6xl">
          Everything <br /> is better <br /> with a&nbsp;
          <span className="bg-gradient-to-br from-[#6b4b3b] to-[#493628] bg-clip-text text-transparent">PINAGPALA</span>
        </h1>

        <p className="mt-4 max-w-xl text-sm text-zinc-600 md:text-base">
          Clean, minimal, and delicious—crafted with the calm polish of a mac-style UI.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                  href="/menu"
                  className="group inline-flex items-center gap-2 rounded-full border border-[#B08B62]/40
                            bg-[#AB886D] px-6 py-2.5 text-white
                            shadow-lg shadow-[#A5724A]/25 transition
                            hover:shadow-[#A5724A]/40
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5E34]/60"
                >
                  Order now
                  <span className="transition-transform group-hover:translate-x-0.5">
                    <Right />
                  </span>
                </a>

          <a href="#about" className="inline-flex items-center gap-2 rounded-full border border-zinc-300/60 bg-white/70 px-6 py-2.5 text-zinc-700 backdrop-blur-md transition hover:bg-white/90 hover:border-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60">
            Learn more <Right />
          </a>
        </div>
      </div>
    </section>
  );
}
