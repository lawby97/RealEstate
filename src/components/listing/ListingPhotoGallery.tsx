"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

export function ListingPhotoGallery({
  photos,
  address,
}: {
  photos: string[];
  address: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(() => new Set());
  const visiblePhotos = useMemo(
    () => photos.filter((url) => !brokenUrls.has(url)),
    [photos, brokenUrls]
  );
  const safeActiveIndex = visiblePhotos.length > 0 ? Math.min(activeIndex, visiblePhotos.length - 1) : 0;
  const activePhoto = visiblePhotos[safeActiveIndex];
  const hiddenPhotoCount = Math.max(0, visiblePhotos.length - 8);
  const hasMultiplePhotos = visiblePhotos.length > 1;

  const showPrevious = () => {
    if (!hasMultiplePhotos) return;
    setActiveIndex((index) => (index - 1 + visiblePhotos.length) % visiblePhotos.length);
  };

  const showNext = () => {
    if (!hasMultiplePhotos) return;
    setActiveIndex((index) => (index + 1) % visiblePhotos.length);
  };

  useEffect(() => {
    if (!expanded) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
        return;
      }
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded, hasMultiplePhotos, visiblePhotos.length]);

  const markBroken = (url: string) => {
    setBrokenUrls((current) => {
      const next = new Set(current);
      next.add(url);
      return next;
    });
    setActiveIndex(0);
  };

  if (!activePhoto) {
    return (
      <div style={styles.emptyPhotos}>
        <div>
          <div style={{ fontWeight: 800, color: "#475569" }}>No photos available</div>
          <div style={{ marginTop: 4, fontSize: 13, color: "#94a3b8" }}>The source did not provide usable listing images.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="listing-photo-gallery" style={styles.gallery} aria-label={`Photos for ${address}`}>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="listing-photo-hero"
          style={styles.heroButton}
          aria-label={`Open listing photo gallery, photo ${safeActiveIndex + 1} of ${visiblePhotos.length}`}
        >
          <Image
            src={activePhoto}
            alt={`${address} listing photo ${safeActiveIndex + 1}`}
            fill
            priority
            sizes="(min-width: 1024px) 720px, 100vw"
            style={{ objectFit: "cover" }}
            onError={() => markBroken(activePhoto)}
          />
          <span style={styles.photoCount}>
            Photo {safeActiveIndex + 1} of {visiblePhotos.length}
          </span>
          <span style={styles.openHint}>Open gallery</span>
        </button>

        {hasMultiplePhotos ? (
          <div className="listing-photo-thumbnail-grid" style={styles.thumbnailGrid}>
            {visiblePhotos.slice(0, 8).map((url, index) => {
              const selected = index === safeActiveIndex;
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  style={{
                    ...styles.thumbnailButton,
                    borderColor: selected ? "#2563eb" : "#e2e8f0",
                    boxShadow: selected ? "0 0 0 2px #bfdbfe" : "none",
                  }}
                  aria-label={`Show listing photo ${index + 1}`}
                  aria-current={selected ? "true" : undefined}
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    sizes="120px"
                    style={{ objectFit: "cover" }}
                    onError={() => markBroken(url)}
                  />
                </button>
              );
            })}
            {hiddenPhotoCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setActiveIndex(8);
                  setExpanded(true);
                }}
                style={styles.morePhotosButton}
                aria-label={`Open ${hiddenPhotoCount} additional listing photos`}
              >
                +{hiddenPhotoCount} more
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {expanded ? (
        <div className="listing-photo-modal" style={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Listing photo viewer">
          <div className="listing-photo-modal-header" style={styles.modalHeader}>
            <div style={{ minWidth: 0 }}>
              <p style={styles.modalEyebrow}>Listing photos</p>
              <p style={styles.modalTitle}>{address}</p>
            </div>
            <span style={styles.modalCounter}>
              Photo {safeActiveIndex + 1} of {visiblePhotos.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="listing-photo-modal-close"
            style={styles.closeButton}
            aria-label="Close photo viewer"
          >
            <X size={20} />
          </button>
          {hasMultiplePhotos ? (
            <button
              type="button"
              onClick={showPrevious}
              className="listing-photo-modal-nav listing-photo-modal-nav-prev"
              style={{ ...styles.navButton, left: 24 }}
              aria-label="Previous photo"
            >
              {"<"}
            </button>
          ) : null}
          <div style={styles.modalImageWrap}>
            <Image
              src={activePhoto}
              alt={`${address} enlarged listing photo ${safeActiveIndex + 1}`}
              fill
              sizes="100vw"
              style={{ objectFit: "contain" }}
              onError={() => markBroken(activePhoto)}
            />
          </div>
          {hasMultiplePhotos ? (
            <button
              type="button"
              onClick={showNext}
              className="listing-photo-modal-nav listing-photo-modal-nav-next"
              style={{ ...styles.navButton, right: 24 }}
              aria-label="Next photo"
            >
              {">"}
            </button>
          ) : null}
          <p className="listing-photo-modal-help" style={styles.modalHelp}>
            Use arrow keys to browse. Press Esc to close.
          </p>
        </div>
      ) : null}
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  gallery: {
    display: "grid",
    gap: 12,
  },
  heroButton: {
    position: "relative",
    width: "100%",
    minHeight: 360,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
    cursor: "zoom-in",
    boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
  },
  photoCount: {
    position: "absolute",
    right: 14,
    bottom: 14,
    padding: "7px 10px",
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.78)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
  },
  openHint: {
    position: "absolute",
    left: 14,
    bottom: 14,
    padding: "7px 10px",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 900,
  },
  thumbnailGrid: {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
  },
  thumbnailButton: {
    position: "relative",
    minHeight: 84,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
    cursor: "pointer",
  },
  morePhotosButton: {
    minHeight: 84,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
    cursor: "zoom-in",
  },
  emptyPhotos: {
    borderRadius: 8,
    border: "1px dashed #cbd5e1",
    backgroundColor: "#f8fafc",
    color: "#64748b",
    display: "grid",
    placeItems: "center",
    minHeight: 260,
    textAlign: "center",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    backgroundColor: "rgba(2,6,23,0.92)",
    display: "grid",
    placeItems: "center",
    padding: 32,
  },
  modalImageWrap: {
    position: "relative",
    width: "min(1100px, 92vw)",
    height: "min(760px, 82vh)",
  },
  modalHeader: {
    position: "fixed",
    top: 22,
    left: 24,
    right: 84,
    zIndex: 51,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    color: "#fff",
    pointerEvents: "none",
  },
  modalEyebrow: {
    margin: 0,
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  modalTitle: {
    margin: "4px 0 0",
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.3,
  },
  modalCounter: {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.22)",
    backgroundColor: "rgba(15,23,42,0.72)",
    color: "#fff",
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  closeButton: {
    position: "fixed",
    top: 24,
    right: 24,
    zIndex: 51,
    width: 42,
    height: 42,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    backgroundColor: "rgba(15,23,42,0.8)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },
  navButton: {
    position: "fixed",
    top: "50%",
    zIndex: 51,
    transform: "translateY(-50%)",
    width: 44,
    height: 44,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    backgroundColor: "rgba(15,23,42,0.8)",
    color: "#fff",
    fontSize: 24,
    fontWeight: 800,
    cursor: "pointer",
  },
  modalHelp: {
    position: "fixed",
    left: "50%",
    bottom: 22,
    transform: "translateX(-50%)",
    margin: 0,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    backgroundColor: "rgba(15,23,42,0.72)",
    color: "#dbeafe",
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 800,
  },
};
