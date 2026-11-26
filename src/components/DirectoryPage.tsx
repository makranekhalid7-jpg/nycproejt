import React, { useState } from 'react';
import { Search } from 'lucide-react';
import {
  DirectoryMember,
  LATEST_WORK,
  SocialFrame,
} from '../data/clubData';
import { EditorialPlate } from './EditorialPlate';

interface DirectoryPageProps {
  directoryMembers: DirectoryMember[];
  onOpenJoinModal: () => void;
  onSelectLightboxFrame: (frame: SocialFrame) => void;
  focusLatestWork?: boolean;
  initialWorkCategory?: string | null;
  onNavigateDirectory?: () => void;
  onNavigateLatestWork?: () => void;
}

export const DirectoryPage: React.FC<DirectoryPageProps> = ({
  directoryMembers,
  onOpenJoinModal,
  onSelectLightboxFrame,
  focusLatestWork = false,
  initialWorkCategory = null,
  onNavigateDirectory,
  onNavigateLatestWork,
}) => {
  const [directorySearch, setDirectorySearch] = useState('');
  const [activeDirectoryTab, setActiveDirectoryTab] = useState<'models' | 'creatives'>('models');
  const [failedWorkImages, setFailedWorkImages] = useState<Record<string, boolean>>({});
  const [failedMemberImages, setFailedMemberImages] = useState<Record<string, boolean>>({});
  const [selectedWorkCategory, setSelectedWorkCategory] = useState<string>(
    initialWorkCategory || 'All Latest'
  );

  const modelDirectory = directoryMembers.filter(
    (m) =>
      m.category === 'model' &&
      (m.name.toLowerCase().includes(directorySearch.toLowerCase()) ||
        m.role.toLowerCase().includes(directorySearch.toLowerCase()))
  );

  const creativeDirectory = directoryMembers.filter(
    (m) =>
      m.category === 'creative' &&
      (m.name.toLowerCase().includes(directorySearch.toLowerCase()) ||
        m.role.toLowerCase().includes(directorySearch.toLowerCase()))
  );

  const hasSearchQuery = directorySearch.trim().length > 0;
  const resolvedTab: 'models' | 'creatives' = hasSearchQuery
    ? activeDirectoryTab === 'creatives' && creativeDirectory.length > 0
      ? 'creatives'
      : modelDirectory.length > 0
        ? 'models'
        : creativeDirectory.length > 0
          ? 'creatives'
          : activeDirectoryTab
    : activeDirectoryTab;

  const visibleMembers = resolvedTab === 'models' ? modelDirectory : creativeDirectory;
  const actionLabel = resolvedTab === 'creatives' ? 'SUBMIT PROFILE' : 'APPLY TO DIRECTORY';

  const workCategories = ['All Latest', ...Array.from(new Set(LATEST_WORK.map((w) => w.category)))];
  const visibleWork =
    selectedWorkCategory === 'All Latest'
      ? LATEST_WORK
      : LATEST_WORK.filter((w) => w.category === selectedWorkCategory);

  const latestWorkSection = (
    <section id="latest-work" className="bg-white text-black py-12 md:py-14">
      <div className="max-w-[1240px] mx-auto px-6 md:px-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
          <div>
            {focusLatestWork && (
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-1.5">
                NYC Model Club · Open to All Models · Visual Archive
              </p>
            )}
            <h2 className="font-editorial italic text-3xl md:text-4xl font-normal leading-tight text-black">
              Latest Work.
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {workCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedWorkCategory(cat)}
                className={`px-3.5 py-1.5 text-xs font-medium tracking-wide whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                  selectedWorkCategory === cat
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
                }`}
              >
                {cat}
              </button>
            ))}
            {focusLatestWork && onNavigateDirectory && (
              <button
                type="button"
                onClick={onNavigateDirectory}
                className="px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider border border-black text-black hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                View Directory
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          {visibleWork.map((item) => {
            const workImgKey = `work-${item.id}`;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  onSelectLightboxFrame({
                    id: item.id,
                    plateVariant: item.variant,
                    imageSrc: item.imageSrc,
                    title: item.brand,
                    caption: item.subtitle,
                    credit: item.category,
                  })
                }
                className="group text-left focus-visible:outline-2 focus-visible:outline-black cursor-pointer"
              >
                <div className="aspect-[3/4] w-full overflow-hidden border border-neutral-200 bg-neutral-100">
                  {item.imageSrc && !failedWorkImages[workImgKey] ? (
                    <img
                      src={item.imageSrc}
                      alt={item.brand}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedWorkImages((prev) => ({ ...prev, [workImgKey]: true }))
                      }
                      className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <EditorialPlate
                      variant={item.variant}
                      className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
                      label={item.brand}
                    />
                  )}
                </div>
                <p className="mt-2 text-xs font-bold text-black">{item.brand}</p>
                <p className="text-[11px] text-neutral-500">{item.category}</p>
                <p className="text-[11px] text-neutral-600 truncate">{item.subtitle}</p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );

  const memberDirectorySection = (
    <section
      id="directory"
      className="bg-white text-black py-12 md:py-14 border-b border-neutral-200"
    >
      <div className="max-w-[1240px] mx-auto px-6 md:px-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-neutral-200 mb-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-1.5">
              NYC Model Club · Open to All Models · Community Roster
            </p>
            <h1 className="font-editorial italic text-3xl md:text-4xl font-normal leading-tight text-black">
              Member Directory.
            </h1>
            <p className="mt-1 text-xs text-neutral-500">
              Active models and creative collaborators across Manhattan &amp; Brooklyn
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 border border-neutral-300 w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <input
              type="text"
              value={directorySearch}
              onChange={(e) => setDirectorySearch(e.target.value)}
              placeholder="Filter models or creatives..."
              aria-label="Filter directory"
              className="w-full text-xs text-black placeholder:text-neutral-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="border border-neutral-200 bg-white p-5 md:p-6">
          {/* Unified Tab Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div
              className="inline-flex border border-neutral-300 bg-white"
              role="tablist"
              aria-label="Member directory categories"
            >
              <button
                type="button"
                role="tab"
                aria-selected={resolvedTab === 'models'}
                onClick={() => setActiveDirectoryTab('models')}
                className={`px-5 py-2 text-xs font-semibold tracking-wide transition-colors cursor-pointer whitespace-nowrap ${
                  resolvedTab === 'models'
                    ? 'bg-black text-white'
                    : 'bg-white text-black hover:bg-neutral-100'
                }`}
              >
                Models ({modelDirectory.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={resolvedTab === 'creatives'}
                onClick={() => setActiveDirectoryTab('creatives')}
                className={`px-5 py-2 text-xs font-semibold tracking-wide border-l border-neutral-300 transition-colors cursor-pointer whitespace-nowrap ${
                  resolvedTab === 'creatives'
                    ? 'bg-black text-white'
                    : 'bg-white text-black hover:bg-neutral-100'
                }`}
              >
                Creatives ({creativeDirectory.length})
              </button>
            </div>

            <div className="flex items-center gap-5">
              {!focusLatestWork && onNavigateLatestWork && (
                <button
                  type="button"
                  onClick={onNavigateLatestWork}
                  className="text-[11px] font-medium uppercase tracking-wider text-neutral-700 hover:text-black cursor-pointer shrink-0"
                >
                  Latest Work Archive
                </button>
              )}
              <button
                type="button"
                onClick={onOpenJoinModal}
                className="text-[11px] font-medium uppercase tracking-wider underline underline-offset-4 text-neutral-800 hover:text-black cursor-pointer shrink-0"
              >
                {actionLabel}
              </button>
            </div>
          </div>

          {/* 4-Column Portrait Photo Card Grid */}
          {visibleMembers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {visibleMembers.map((m) => {
                const memberImgKey = `member-${m.id}`;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={onOpenJoinModal}
                    className="group text-left border border-neutral-200 bg-white hover:border-black transition-colors focus-visible:outline-2 focus-visible:outline-black cursor-pointer flex flex-col overflow-hidden"
                  >
                    <div className="aspect-[3/2] w-full overflow-hidden bg-neutral-100">
                      {m.imageSrc && !failedMemberImages[memberImgKey] ? (
                        <img
                          src={m.imageSrc}
                          alt={m.name}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedMemberImages((prev) => ({
                              ...prev,
                              [memberImgKey]: true,
                            }))
                          }
                          className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <EditorialPlate
                          variant={m.variant}
                          className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
                          label={m.name}
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-bold text-black truncate">{m.name}</p>
                      <p className="text-xs text-neutral-600 mt-0.5 truncate">{m.role}</p>
                      {(m.isMinor ||
                        m.visibility === 'clients_only' ||
                        m.visibilityScope === 'verified_clients_only') && (
                        <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-700 mt-1 truncate">
                          Private Minor · Clients Only
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-xs text-neutral-500">
              {hasSearchQuery
                ? `No matching models or creatives found for “${directorySearch.trim()}”.`
                : 'No directory members found in this category.'}
            </p>
          )}
        </div>
      </div>
    </section>
  );

  if (focusLatestWork) {
    return (
      <>
        {latestWorkSection}
        {memberDirectorySection}
      </>
    );
  }

  return (
    <>
      {memberDirectorySection}
      {latestWorkSection}
    </>
  );
};
