/* ============================================================
   Claud — ChartFullscreen wrapper.
   Loaded AFTER pages.jsx and BEFORE the chart-bearing modules
   (investments.jsx, foresight.jsx, accounts.jsx, app.jsx). Exposes
   <ChartFullscreen> on window.

   Wrap any chart:
       <ChartFullscreen title="Cash flow">
         <Sankey … />
       </ChartFullscreen>

   It overlays a small expand button at the chart's top-right (shown
   on mobile-width viewports only — the CSS lives in app.html). Tapping
   it opens a full-screen overlay; on a portrait phone the stage is
   rotated 90° so the chart fills the screen in landscape, big and
   legible. A matching × sits in the same corner to close it; Escape
   and a tap on the backdrop also close.

   The chart itself is moved into the overlay (not cloned), so it stays
   fully interactive. Charts here are viewBox SVGs at width:100%, so they
   scale up to fill the stage with no size props needed.
   ============================================================ */
(function () {
  const { useState, useEffect } = React;

  function ExpandIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 3H5a2 2 0 0 0-2 2v3" />
        <path d="M16 3h3a2 2 0 0 1 2 2v3" />
        <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
        <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      </svg>
    );
  }

  function ChartFullscreen({ title, className, children }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
      if (!open) return;
      function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } }
      document.addEventListener("keydown", onKey, true);
      document.body.classList.add("cfs-lock");
      return () => { document.removeEventListener("keydown", onKey, true); document.body.classList.remove("cfs-lock"); };
    }, [open]);

    return (
      <div className={"cfs-host" + (className ? " " + className : "")}>
        <button type="button" className="cfs-open-btn" title="View full screen"
          aria-label="View chart full screen" onClick={() => setOpen(true)}>
          <ExpandIcon />
        </button>

        {open
          ? (
            <div className="cfs-overlay" role="dialog" aria-modal="true"
              aria-label={(title || "Chart") + " — full screen"}
              onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
              <div className="cfs-stage">
                <div className="cfs-stage-bar">
                  <span className="cfs-stage-title">{title || ""}</span>
                  <button type="button" className="cfs-close-btn" title="Close full screen"
                    aria-label="Close full screen" onClick={() => setOpen(false)}>{"×"}</button>
                </div>
                <div className="cfs-stage-body">{children}</div>
              </div>
            </div>
          )
          : children}
      </div>
    );
  }

  window.ChartFullscreen = ChartFullscreen;
})();
