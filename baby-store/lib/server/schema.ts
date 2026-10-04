// مخطط قاعدة البيانات. كل ترحيل يُنفذ مرة واحدة بالترتيب ويُسجل رقمه في جدول meta.
// المبالغ المالية تُخزن كأعداد صحيحة بوحدة "السنت" (المبلغ × 100) لتجنب أخطاء الكسور.

export const MIGRATIONS: string[] = [
  /* 1 */ `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE counters (key TEXT PRIMARY KEY, value INTEGER NOT NULL);

  CREATE TABLE media (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('public','private')),
    path TEXT NOT NULL,
    ext TEXT NOT NULL,
    mime TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    sizes TEXT NOT NULL DEFAULT '[]',
    bytes INTEGER NOT NULL DEFAULT 0,
    original_name TEXT,
    purpose TEXT NOT NULL DEFAULT 'general',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE admin_users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    failed_logins INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    last_login_at TEXT,
    notif_seen_id INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    ip TEXT,
    user_agent TEXT
  );
  CREATE INDEX idx_sessions_user ON sessions(user_id);

  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    user_name TEXT,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    details TEXT,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_audit_created ON audit_log(created_at);

  CREATE TABLE rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
  );

  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    permission TEXT NOT NULL DEFAULT 'orders',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE appearance_versions (
    id INTEGER PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('draft','published','archived')),
    data TEXT NOT NULL,
    note TEXT,
    created_by INTEGER,
    created_by_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    published_at TEXT
  );

  CREATE TABLE pages (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
    show_in_footer INTEGER NOT NULL DEFAULT 1,
    system INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0,
    seo_title TEXT,
    seo_description TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE faqs (
    id INTEGER PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1,
    hidden_filters TEXT NOT NULL DEFAULT '[]',
    seo_title TEXT,
    seo_description TEXT,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE tag_groups (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL DEFAULT 'custom' CHECK (kind IN ('age','occasion','custom')),
    show_in_filters INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES tag_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE size_guides (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    intro TEXT,
    columns TEXT NOT NULL DEFAULT '[]',
    rows TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    image_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'simple' CHECK (type IN ('simple','variable','bundle')),
    sku TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    short_description TEXT,
    description TEXT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
    price INTEGER NOT NULL DEFAULT 0,
    sale_price INTEGER,
    sale_starts_at TEXT,
    sale_ends_at TEXT,
    track_stock INTEGER NOT NULL DEFAULT 1,
    stock INTEGER NOT NULL DEFAULT 0,
    manual_availability TEXT NOT NULL DEFAULT 'in_stock' CHECK (manual_availability IN ('in_stock','out_of_stock')),
    low_stock_threshold INTEGER,
    max_per_order INTEGER,
    options TEXT NOT NULL DEFAULT '[]',
    material TEXT,
    care_instructions TEXT,
    size_guide_id INTEGER REFERENCES size_guides(id) ON DELETE SET NULL,
    set_contents TEXT NOT NULL DEFAULT '[]',
    pieces_count INTEGER,
    prep_days_min INTEGER,
    prep_days_max INTEGER,
    gift_wrap_eligible INTEGER NOT NULL DEFAULT 1,
    personalization TEXT,
    seo_title TEXT,
    seo_description TEXT,
    search_text TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    published_at TEXT
  );
  CREATE INDEX idx_products_status ON products(status);
  CREATE INDEX idx_products_category ON products(category_id);

  CREATE TABLE product_images (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    media_id INTEGER NOT NULL REFERENCES media(id),
    alt TEXT,
    option_value TEXT,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_product_images_product ON product_images(product_id);

  CREATE TABLE variants (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL UNIQUE COLLATE NOCASE,
    option1 TEXT,
    option2 TEXT,
    option3 TEXT,
    price INTEGER,
    sale_price INTEGER,
    stock INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_variants_product ON variants(product_id);

  CREATE TABLE product_tags (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, tag_id)
  );

  CREATE TABLE product_relations (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    related_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('related','complementary')),
    sort INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, related_id, kind)
  );

  CREATE TABLE bundle_items (
    id INTEGER PRIMARY KEY,
    bundle_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    variant_id INTEGER REFERENCES variants(id) ON DELETE SET NULL,
    qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_bundle_items_bundle ON bundle_items(bundle_id);

  CREATE TABLE stock_movements (
    id INTEGER PRIMARY KEY,
    product_id INTEGER,
    variant_id INTEGER,
    sku TEXT,
    product_name TEXT,
    change INTEGER NOT NULL,
    stock_after INTEGER,
    reason TEXT NOT NULL,
    order_id INTEGER,
    user_id INTEGER,
    user_name TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_movements_product ON stock_movements(product_id, created_at);

  CREATE TABLE gift_wraps (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    image_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE shipping_zones (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'اليمن',
    cities TEXT NOT NULL DEFAULT '[]',
    fee INTEGER NOT NULL DEFAULT 0,
    free_shipping_eligible INTEGER NOT NULL DEFAULT 1,
    eta_text TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    is_demo INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE transfer_methods (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'bank' CHECK (type IN ('bank','wallet','exchange','other')),
    beneficiary TEXT NOT NULL,
    account_number TEXT NOT NULL,
    extra_info TEXT,
    currency TEXT,
    instructions TEXT,
    qr_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE coupons (
    id INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('percent','fixed')),
    value INTEGER NOT NULL,
    min_order INTEGER,
    max_discount INTEGER,
    starts_at TEXT,
    ends_at TEXT,
    usage_limit INTEGER,
    per_customer_limit INTEGER,
    category_ids TEXT NOT NULL DEFAULT '[]',
    product_ids TEXT NOT NULL DEFAULT '[]',
    combine_with_sale INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    country TEXT,
    city TEXT,
    area TEXT,
    address TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_order_at TEXT
  );

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    idempotency_key TEXT UNIQUE,
    customer_id INTEGER REFERENCES customers(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_country TEXT,
    customer_city TEXT,
    customer_area TEXT,
    customer_address TEXT,
    customer_landmark TEXT,
    customer_map_url TEXT,
    notes TEXT,
    fulfillment TEXT NOT NULL CHECK (fulfillment IN ('delivery','pickup')),
    zone_id INTEGER,
    zone_name TEXT,
    eta_text TEXT,
    is_gift INTEGER NOT NULL DEFAULT 0,
    recipient_name TEXT,
    recipient_phone TEXT,
    recipient_country TEXT,
    recipient_city TEXT,
    recipient_area TEXT,
    recipient_address TEXT,
    gift_message TEXT,
    hide_prices INTEGER NOT NULL DEFAULT 0,
    gift_wrap_id INTEGER,
    gift_wrap_name TEXT,
    subtotal INTEGER NOT NULL,
    discount INTEGER NOT NULL DEFAULT 0,
    wrap_fee INTEGER NOT NULL DEFAULT 0,
    personalization_fee INTEGER NOT NULL DEFAULT 0,
    shipping_fee INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL,
    currency TEXT NOT NULL,
    currency_symbol TEXT NOT NULL,
    coupon_id INTEGER,
    coupon_code TEXT,
    transfer_method_id INTEGER,
    transfer_method_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','confirmed','preparing','shipped','completed','cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'awaiting_transfer'
      CHECK (payment_status IN ('awaiting_transfer','under_review','partially_paid','paid','needs_review','partially_refunded','refunded')),
    stock_state TEXT NOT NULL DEFAULT 'reserved' CHECK (stock_state IN ('reserved','committed','released','none')),
    reservation_expires_at TEXT,
    reservation_released_at TEXT,
    prep_days_min INTEGER,
    prep_days_max INTEGER,
    shipping_carrier TEXT,
    tracking_number TEXT,
    tracking_url TEXT,
    shipped_at TEXT,
    completed_at TEXT,
    cancelled_at TEXT,
    cancel_reason TEXT,
    payment_confirmed_by INTEGER,
    payment_confirmed_by_name TEXT,
    payment_confirmed_at TEXT,
    ip_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_orders_status ON orders(status);
  CREATE INDEX idx_orders_payment ON orders(payment_status);
  CREATE INDEX idx_orders_created ON orders(created_at);
  CREATE INDEX idx_orders_phone ON orders(customer_phone);
  CREATE INDEX idx_orders_coupon ON orders(coupon_id);

  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER,
    variant_id INTEGER,
    product_type TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    options TEXT NOT NULL DEFAULT '[]',
    image TEXT,
    unit_price INTEGER NOT NULL,
    compare_price INTEGER,
    qty INTEGER NOT NULL,
    line_total INTEGER NOT NULL,
    personalization_label TEXT,
    personalization_text TEXT,
    personalization_fee INTEGER NOT NULL DEFAULT 0,
    components TEXT NOT NULL DEFAULT '[]',
    returned_qty INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_order_items_order ON order_items(order_id);
  CREATE INDEX idx_order_items_product ON order_items(product_id);

  CREATE TABLE order_stock_lines (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL,
    variant_id INTEGER,
    sku TEXT,
    name TEXT,
    qty INTEGER NOT NULL,
    deducted INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_stock_lines_order ON order_stock_lines(order_id);

  CREATE TABLE order_attachments (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    media_id INTEGER NOT NULL REFERENCES media(id),
    label TEXT,
    uploaded_by INTEGER,
    uploaded_by_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE payments (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method_id INTEGER,
    method_name TEXT,
    amount INTEGER NOT NULL,
    transfer_date TEXT,
    reference TEXT,
    sender_name TEXT,
    notes TEXT,
    attachment_id INTEGER REFERENCES order_attachments(id) ON DELETE SET NULL,
    recorded_by INTEGER,
    recorded_by_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_payments_order ON payments(order_id);
  CREATE INDEX idx_payments_reference ON payments(reference);

  CREATE TABLE refunds (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    method TEXT,
    reference TEXT,
    reason TEXT,
    created_by INTEGER,
    created_by_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE order_returns (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    items TEXT NOT NULL,
    reason TEXT,
    restocked INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER,
    created_by_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE order_notes (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER,
    user_name TEXT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE order_events (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    public INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER,
    user_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_order_events_order ON order_events(order_id);
  `,
  // 2: علامة البيانات التجريبية لخيارات التغليف (تُحذف مع البيانات التجريبية)
  `ALTER TABLE gift_wraps ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;
   UPDATE gift_wraps SET is_demo=1 WHERE name LIKE '%(تجريبي)%';`,
]
