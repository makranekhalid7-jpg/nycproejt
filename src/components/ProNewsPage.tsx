import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { EditorialStory, PRO_NEWS_STORIES } from '../data/clubData';
import { EditorialPlate } from './EditorialPlate';

interface ProNewsPageProps {
  onSelectStory: (story: EditorialStory) => void;
  onUnlockMembership: () => void;
}

export const ProNewsPage: React.FC<ProNewsPageProps> = ({
  onSelectStory,
  onUnlockMembership,
}) => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  return (
    <section className="bg-white text-black py-12 md:py-16">
      <div className="max-w-[1240px] mx-auto px-6 md:px-10">
        {/* Editorial Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-neutral-200 mb-10">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-1.5">
              NYC Model Club · Open to All Models · Casting &amp; Industry Intelligence
            </p>
            <h1
              className="font-editorial font-normal italic tracking-[-0.02em] text-black leading-[1.02]"
              style={{ fontSize: 'clamp(2.2rem, 4.2vw, 3.4rem)' }}
            >
              Pro News.
            </h1>
            <p className="mt-2.5 text-sm text-neutral-600 leading-relaxed max-w-xl">
              Editorial dispatches, SoHo showroom reports, and casting intelligence curated for
              New York City talent, photographers, and booking desks.
            </p>
          </div>

          <button
            type="button"
            onClick={onUnlockMembership}
            className="px-5 py-3 bg-black text-white text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer self-start lg:self-auto"
          >
            <span>Unlock Full Briefs via Membership</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Pro News Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PRO_NEWS_STORIES.map((story) => (
            <button
              key={story.id}
              type="button"
              onClick={() => onSelectStory(story)}
              className="group text-left flex flex-col focus-visible:outline-2 focus-visible:outline-black cursor-pointer"
            >
              <div className="aspect-[4/3] w-full overflow-hidden border border-neutral-200 bg-neutral-100">
                {story.imageSrc && !failedImages[story.id] ? (
                  <img
                    src={story.imageSrc}
                    alt={story.title}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [story.id]: true }))
                    }
                    className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <EditorialPlate
                    variant={story.variant}
                    className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
                    label={story.title}
                  />
                )}
              </div>
              <span className="mt-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                {story.kicker}
              </span>
              <h2 className="mt-1 font-display font-semibold text-sm leading-snug text-black group-hover:underline underline-offset-4">
                {story.title}
              </h2>
              <span className="mt-1 text-[11px] text-neutral-500 uppercase tracking-wide">
                {story.byline}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
