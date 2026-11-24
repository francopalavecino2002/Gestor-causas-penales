-- Private iCalendar feed of each member's hearings (ADR-0034). The secret lives only in the member's
-- calendar app: the table keeps its SHA-256, so a database leak does not expose the feeds. A new
-- link revokes the old one; revoked rows stay (nothing is deleted).
CREATE TABLE calendar_feed_token (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid        NOT NULL REFERENCES tenant (id),
    user_id    uuid        NOT NULL REFERENCES app_user (id),
    token_hash varchar(64) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz
);

CREATE UNIQUE INDEX calendar_feed_token_hash_uk ON calendar_feed_token (token_hash);

-- At most one live link per member.
CREATE UNIQUE INDEX calendar_feed_token_live_user_uk ON calendar_feed_token (user_id) WHERE revoked_at IS NULL;
