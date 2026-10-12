import React from 'react';
import type { ShipLogEntry } from '../types';

interface ShipLogProps {
  logs: ShipLogEntry[];
}

export const ShipLog: React.FC<ShipLogProps> = ({ logs }) => {
  return (
    <section className="sup-section ship-log-section">
      <div className="sup-section-band">
        <div className="sup-coordcell">
          <span className="sup-idx">04</span>
        </div>
        <div className="sup-titlecell">
          <div className="sup-title-meta">
            <span className="sup-kicker">CHRONICLE OF ACCOUNTS</span>
            <span className="sup-pill-status">
              <i>●</i> Append-Only Ledger
            </span>
          </div>
          <h2 className="sup-h2">The Ship’s Log</h2>
          <p className="sup-section-lede">
            Atomic sequence of all movements placed aboard, settled under warrant, or brought ashore.
          </p>
        </div>
        <div className="sup-section-cta">
          <span className="sup-count-tag font-mono">{logs.length} Entries Recorded</span>
        </div>
      </div>

      <div className="sup-log-bento">
        {logs.length === 0 ? (
          <div className="empty-log-state">No movements recorded aboard yet.</div>
        ) : (
          <div className="log-entries-table">
            {logs.map((entry) => {
              const isCameAboard = entry.primaryText.includes('Came aboard');
              const isRevoked = entry.primaryText.includes('revoked');
              const isAshore = entry.primaryText.includes('ashore');

              const badgeType = isCameAboard
                ? 'badge-came-aboard'
                : isRevoked
                ? 'badge-revoked'
                : isAshore
                ? 'badge-ashore'
                : 'badge-neutral';

              const tagText = isCameAboard
                ? 'CAME ABOARD'
                : isRevoked
                ? 'REVOKED'
                : isAshore
                ? 'ASHORE'
                : entry.type.toUpperCase();

              return (
                <div key={entry.id} className="log-entry-row">
                  <div className="log-entry-time font-mono">{entry.timestamp}</div>

                  <div className="log-entry-tag">
                    <span className={`sup-log-pill ${badgeType}`}>{tagText}</span>
                  </div>

                  <div className="log-entry-content">
                    <span className={`log-entry-sentence ${isCameAboard ? 'text-came-aboard' : isRevoked ? 'text-revoked' : ''}`}>
                      {entry.primaryText}
                    </span>
                  </div>

                  <div className="log-entry-hash font-mono">
                    <code>{entry.hash}</code>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
