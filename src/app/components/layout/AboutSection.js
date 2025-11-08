'use client';

import { useState } from 'react';
import SectionHeaders from './SectionHeaders';

export default function AboutSection() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <section className="mx-auto my-16 max-w-3xl text-center" id="about">
        <SectionHeaders subHeader="Our story" mainHeader="About us" />
        <p className="mt-4 text-zinc-600">
          Pngpl Cafe ☕ – A small business coffee shop serving blessed cups with love and
          community. Join us for great coffee, warm fellowship, and a peaceful atmosphere.
        </p>
        
        {/* Read More Button */}
        <button
          onClick={() => setShowModal(true)}
          className="cursor-pointer mt-6 inline-flex items-center gap-2 rounded-full border border-zinc-300/60 bg-white/80 px-6 py-2.5 font-semibold text-zinc-700 backdrop-blur-md transition hover:border-zinc-400 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"
        >
          {/* Book/Story icon */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1.1em" height="1.1em" aria-hidden="true">
            <path
              fill="currentColor"
              d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"
            />
          </svg>
          <span>Read Our Full Story</span>
        </button>
      </section>

      {/* Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowModal(false)}
              className="cursor-pointer absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 text-2xl font-bold"
              aria-label="Close modal"
            >
              ×
            </button>

            {/* Modal Content */}
            <div className="pr-8">
              <h2 className="text-2xl font-bold text-zinc-900 mb-2">Our Full Story</h2>
              <div className="h-1 w-20 bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] rounded-full mb-6"></div>
              
              <div className="space-y-4 text-zinc-700 leading-relaxed">
                <p>
                  <strong className="text-[#A5724A]">Pngpl Café</strong>, established in <strong>September 2023</strong>, 
                  began as a small rental catering business inspired by the owner&apos;s dream of creating a faith-based café.
                </p>
                
                <p>
                  The name <strong>&quot;Pngpl,&quot;</strong> derived from the Tagalog word <em>pinagpala</em> (meaning <strong>&quot;blessed&quot;</strong>), 
                  reflects the owner&apos;s religious values and the blessing they hope to share with every cup served.
                </p>
                
                <p>
                  Starting from home and pop-up stores with an initial investment of just <strong>₱2,000</strong>, 
                  the café gained recognition through church support and word-of-mouth from our blessed community.
                </p>
                
                <p>
                  Today, Pngpl Café proudly operates at <strong>Puregold Jr. Batasan San Mateo Road</strong>, 
                  continuing to serve great coffee, warm fellowship, and a peaceful atmosphere where everyone is welcome.
                </p>

                <div className="mt-6 pt-6 border-t border-zinc-200">
                  <p className="text-sm text-zinc-500 italic text-center">
                    &quot;Every cup is blessed. Every customer is family.&quot; ☕
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}