// Storefront script signatures for Shopify apps and tracking pixels.
// Patterns run case-insensitively against homepage + product page HTML with inline <svg> removed
// (payment icon SVGs would otherwise cause false positives like "klarna").
// Prefer CDN hostnames or unique global/JS identifiers over generic words.

export type AppSignature = { name: string; category: AppCategory; re: RegExp };

export type AppCategory =
  | "Reviews"
  | "Social & UGC"
  | "Email & SMS"
  | "Subscriptions"
  | "Loyalty & Referrals"
  | "Upsell & Bundles"
  | "Search & Merchandising"
  | "Page builder"
  | "Support & Chat"
  | "Popups & Conversion"
  | "Consent & Privacy"
  | "Translation"
  | "Shipping & Returns"
  | "Buy now, pay later"
  | "Product options"
  | "Wishlist"
  | "Accessibility"
  | "Analytics & Attribution";

export const APP_SIGNATURES: AppSignature[] = [
  // Reviews and social proof
  { name: "Judge.me", category: "Reviews", re: /judge\.me|judgeme/ },
  { name: "Yotpo", category: "Reviews", re: /staticw2\.yotpo\.com|cdn-widgetsrepository\.yotpo\.com|yotpo-widget/ },
  { name: "Loox", category: "Reviews", re: /loox\.io|loox-rating/ },
  { name: "Okendo", category: "Reviews", re: /okendo\.io|oke-reviews|okeReviews/ },
  { name: "Stamped.io", category: "Reviews", re: /stamped\.io/ },
  { name: "REVIEWS.io", category: "Reviews", re: /widget\.reviews\.io|reviews\.co\.uk/ },
  { name: "Trustpilot", category: "Reviews", re: /widget\.trustpilot\.com|trustpilot-widget/ },
  { name: "Trusted Shops", category: "Reviews", re: /trustedshops\.(com|de)|etrusted/ },
  { name: "Junip", category: "Reviews", re: /junip\.co|junip-/ },
  { name: "Ali Reviews", category: "Reviews", re: /alireviews|ali-reviews/ },
  { name: "Fera", category: "Reviews", re: /fera\.ai/ },
  { name: "Feefo", category: "Reviews", re: /api\.feefo\.com|feefo-/ },
  { name: "Shopify Product Reviews (legacy)", category: "Reviews", re: /productreviews\.shopifycdn|spr-badge|spr-container/ },
  { name: "Instafeed", category: "Social & UGC", re: /instafeed/ },
  { name: "Elfsight", category: "Social & UGC", re: /elfsight/ },
  { name: "Foursixty", category: "Social & UGC", re: /foursixty/ },
  { name: "Covet.pics", category: "Social & UGC", re: /covet\.pics|covet-pics/ },
  { name: "Tolstoy", category: "Social & UGC", re: /gotolstoy|tolstoy-/ },
  { name: "Videowise", category: "Social & UGC", re: /videowise/ },

  // Email & SMS
  { name: "Klaviyo", category: "Email & SMS", re: /klaviyo/ },
  { name: "Omnisend", category: "Email & SMS", re: /omnisnippet|omnisend/ },
  { name: "Mailchimp", category: "Email & SMS", re: /chimpstatic\.com|list-manage\.com/ },
  { name: "Privy", category: "Email & SMS", re: /privy\.com|widget\.privy/ },
  { name: "Attentive", category: "Email & SMS", re: /attn\.tv|attentivemobile/ },
  { name: "Postscript", category: "Email & SMS", re: /postscript\.io/ },
  { name: "Brevo (Sendinblue)", category: "Email & SMS", re: /sibautomation|sendinblue|brevo\.com/ },
  { name: "Drip", category: "Email & SMS", re: /tag\.getdrip\.com/ },
  { name: "MailerLite", category: "Email & SMS", re: /mailerlite/ },
  { name: "Recart", category: "Email & SMS", re: /recart\.com|recart-/ },
  { name: "PushOwl", category: "Email & SMS", re: /pushowl/ },

  // Subscriptions
  { name: "Recharge", category: "Subscriptions", re: /rechargecdn\.com|rechargepayments\.com|rechargeapps\.com/ },
  { name: "Skio", category: "Subscriptions", re: /skio\.com|skio-plan-picker/ },
  { name: "Appstle Subscriptions", category: "Subscriptions", re: /appstle/ },
  { name: "Seal Subscriptions", category: "Subscriptions", re: /sealsubscriptions/ },
  { name: "Loop Subscriptions", category: "Subscriptions", re: /loopsubscriptions/ },
  { name: "Smartrr", category: "Subscriptions", re: /smartrr/ },
  { name: "Stay AI", category: "Subscriptions", re: /retextion|stay\.ai/ },
  { name: "Bold Commerce", category: "Subscriptions", re: /boldapps\.net|boldcommerce\.com/ },

  // Loyalty & Referrals
  { name: "Smile.io", category: "Loyalty & Referrals", re: /smile\.io|sweettooth\.io/ },
  { name: "LoyaltyLion", category: "Loyalty & Referrals", re: /loyaltylion/ },
  { name: "Rivo", category: "Loyalty & Referrals", re: /rivo\.io/ },
  { name: "Growave", category: "Loyalty & Referrals", re: /growave|socialshopwave/ },
  { name: "BON Loyalty", category: "Loyalty & Referrals", re: /bonloyalty/ },
  { name: "Yotpo Loyalty", category: "Loyalty & Referrals", re: /swellrewards/ },
  { name: "ReferralCandy", category: "Loyalty & Referrals", re: /referralcandy/ },

  // Upsell & Bundles
  { name: "Rebuy", category: "Upsell & Bundles", re: /rebuyengine/ },
  { name: "ReConvert", category: "Upsell & Bundles", re: /reconvert/ },
  { name: "Frequently Bought Together", category: "Upsell & Bundles", re: /codeblackbelt|cbb-frequently/ },
  { name: "Zipify", category: "Upsell & Bundles", re: /zipify/ },
  { name: "AfterSell", category: "Upsell & Bundles", re: /aftersell/ },
  { name: "UpCart", category: "Upsell & Bundles", re: /\bupcart/ },
  { name: "Kaching Bundles", category: "Upsell & Bundles", re: /kaching-bundles|kachingbundles/ },
  { name: "Fast Bundle", category: "Upsell & Bundles", re: /fastbundle/ },
  { name: "Bundler", category: "Upsell & Bundles", re: /bundler\.app/ },
  { name: "Selleasy", category: "Upsell & Bundles", re: /selleasy/ },
  { name: "LimeSpot", category: "Upsell & Bundles", re: /limespot/ },
  { name: "Nosto", category: "Upsell & Bundles", re: /nosto\.com|nostojs/ },

  // Search & Merchandising
  { name: "Searchanise", category: "Search & Merchandising", re: /searchanise/ },
  { name: "Boost AI Search & Filter", category: "Search & Merchandising", re: /boost-pfs|boostcommerce|bc-sf-filter/ },
  { name: "Klevu", category: "Search & Merchandising", re: /klevu/ },
  { name: "Algolia", category: "Search & Merchandising", re: /algolia/ },
  { name: "Doofinder", category: "Search & Merchandising", re: /doofinder/ },
  { name: "Findify", category: "Search & Merchandising", re: /findify/ },
  { name: "Searchspring", category: "Search & Merchandising", re: /searchspring/ },
  { name: "Constructor.io", category: "Search & Merchandising", re: /cnstrc\.com|constructor\.io/ },
  { name: "Clerk.io", category: "Search & Merchandising", re: /clerk\.io/ },

  // Page builders
  { name: "PageFly", category: "Page builder", re: /pagefly/ },
  { name: "GemPages", category: "Page builder", re: /gempages|gemcommerce/ },
  { name: "Shogun", category: "Page builder", re: /getshogun|shogun-frontend|cdn\.shogun/ },
  { name: "Replo", category: "Page builder", re: /replo\.app|data-replo|replo-/ },
  { name: "EComposer", category: "Page builder", re: /ecomposer/ },
  { name: "Instant", category: "Page builder", re: /instant\.so/ },

  // Support & Chat
  { name: "Gorgias", category: "Support & Chat", re: /gorgias/ },
  { name: "Tidio", category: "Support & Chat", re: /tidio/ },
  { name: "Zendesk", category: "Support & Chat", re: /zdassets\.com|zopim/ },
  { name: "Intercom", category: "Support & Chat", re: /widget\.intercom\.io|intercomcdn/ },
  { name: "Re:amaze", category: "Support & Chat", re: /reamaze/ },
  { name: "Shopify Inbox", category: "Support & Chat", re: /shopifychat|shopify-chat/ },
  { name: "Freshchat", category: "Support & Chat", re: /freshchat|freshworks/ },
  { name: "Richpanel", category: "Support & Chat", re: /richpanel/ },
  { name: "Gladly", category: "Support & Chat", re: /gladly\.com/ },
  { name: "Crisp", category: "Support & Chat", re: /client\.crisp\.chat/ },
  { name: "LiveChat", category: "Support & Chat", re: /livechatinc/ },
  { name: "Tawk.to", category: "Support & Chat", re: /embed\.tawk\.to/ },

  // Popups & Conversion
  { name: "Justuno", category: "Popups & Conversion", re: /justuno/ },
  { name: "OptiMonk", category: "Popups & Conversion", re: /optimonk/ },
  { name: "Wisepops", category: "Popups & Conversion", re: /wisepops/ },
  { name: "Poptin", category: "Popups & Conversion", re: /poptin/ },
  { name: "Hextom", category: "Popups & Conversion", re: /hextom/ },
  { name: "Vitals", category: "Popups & Conversion", re: /vitals\.co|appsolve/ },

  // Consent & Privacy (important for EU stores)
  { name: "Shopify cookie banner", category: "Consent & Privacy", re: /privacy-banner\/storefront-banner|shopify-privacy-banner/ },
  { name: "Cookiebot", category: "Consent & Privacy", re: /cookiebot/ },
  { name: "OneTrust", category: "Consent & Privacy", re: /cookielaw\.org|onetrust/ },
  { name: "Pandectes", category: "Consent & Privacy", re: /pandectes/ },
  { name: "Consentmo", category: "Consent & Privacy", re: /consentmo(?!de)|gdpr-legal-cookie/ },
  { name: "Usercentrics", category: "Consent & Privacy", re: /usercentrics/ },
  { name: "iubenda", category: "Consent & Privacy", re: /iubenda/ },
  { name: "CookieYes", category: "Consent & Privacy", re: /cookieyes/ },
  { name: "Termly", category: "Consent & Privacy", re: /termly\.io/ },
  { name: "Enzuzo", category: "Consent & Privacy", re: /enzuzo/ },

  // Translation
  { name: "Weglot", category: "Translation", re: /weglot/ },
  { name: "Langify", category: "Translation", re: /langify/ },
  { name: "LangShop", category: "Translation", re: /langshop/ },
  { name: "Transcy", category: "Translation", re: /transcy/ },
  { name: "GTranslate", category: "Translation", re: /gtranslate/ },

  // Shipping & Returns
  { name: "Route", category: "Shipping & Returns", re: /routeapp|route-widget/ },
  { name: "AfterShip", category: "Shipping & Returns", re: /aftership/ },
  { name: "Loop Returns", category: "Shipping & Returns", re: /loopreturns/ },
  { name: "ParcelPanel", category: "Shipping & Returns", re: /parcelpanel/ },
  { name: "Sendcloud", category: "Shipping & Returns", re: /sendcloud/ },
  { name: "17TRACK", category: "Shipping & Returns", re: /17track/ },

  // Buy now, pay later widgets
  { name: "Klarna messaging", category: "Buy now, pay later", re: /klarna-placement|js\.klarna\.com|klarnaservices/ },
  { name: "Afterpay / Clearpay", category: "Buy now, pay later", re: /afterpay-placement|clearpay-placement|static\.afterpay\.com|js\.afterpay\.com/ },
  { name: "PayPal Pay Later", category: "Buy now, pay later", re: /paypal\.com\/sdk\/js|data-pp-message/ },
  { name: "Sezzle", category: "Buy now, pay later", re: /widget\.sezzle|sezzle-widget|sezzle\.com\/v1/ },
  { name: "Affirm", category: "Buy now, pay later", re: /cdn1\.affirm\.com|affirm-as-low-as/ },
  { name: "Scalapay", category: "Buy now, pay later", re: /scalapay/ },
  { name: "Alma", category: "Buy now, pay later", re: /getalma|alma-widget/ },
  { name: "Shop Pay Installments", category: "Buy now, pay later", re: /shopify-installments|shop-pay-installments|installments-banner/ },

  // Product options
  { name: "Infinite Options", category: "Product options", re: /shoppad|infiniteoptions/ },
  { name: "Globo Product Options", category: "Product options", re: /globosoftware|globo-product-options/ },
  { name: "Hulk Apps", category: "Product options", re: /hulkapps/ },
  { name: "Kiwi Size Chart", category: "Product options", re: /kiwisizing|kiwi-sizing/ },

  // Wishlist
  { name: "Swym Wishlist Plus", category: "Wishlist", re: /swymcdn|swym-/ },
  { name: "Wishlist Hero", category: "Wishlist", re: /wishlisthero|wishlist-hero/ },

  // Accessibility
  { name: "accessiBe", category: "Accessibility", re: /acsbapp|accessibe/ },
  { name: "UserWay", category: "Accessibility", re: /userway/ },
  { name: "AudioEye", category: "Accessibility", re: /audioeye/ },

  // Analytics & Attribution
  { name: "Triple Whale", category: "Analytics & Attribution", re: /triplewhale|triple-pixel|triplepixel/ },
  { name: "Elevar", category: "Analytics & Attribution", re: /getelevar|elevar\.io|elevar[-_]/ },
  { name: "Northbeam", category: "Analytics & Attribution", re: /northbeam/ },
  { name: "Littledata", category: "Analytics & Attribution", re: /littledata/ },
  { name: "Analyzify", category: "Analytics & Attribution", re: /analyzify/ },
  { name: "Polar Analytics", category: "Analytics & Attribution", re: /polaranalytics|polar-analytics/ },
  { name: "Lucky Orange", category: "Analytics & Attribution", re: /luckyorange/ },
  { name: "Hotjar", category: "Analytics & Attribution", re: /static\.hotjar\.com|hotjar/ },
  { name: "Microsoft Clarity", category: "Analytics & Attribution", re: /clarity\.ms/ },
  { name: "Segment", category: "Analytics & Attribution", re: /cdn\.segment\.com/ },
];

export type PixelSignature = {
  name: string;
  marketing: boolean;
  /** Any match means the pixel is present */
  present: RegExp;
  /** Global regexes; capture group 1 is the pixel/tag ID */
  ids?: RegExp[];
};

export const PIXEL_SIGNATURES: PixelSignature[] = [
  {
    name: "Google Analytics 4",
    marketing: false,
    present: /googletagmanager\.com\/gtag|gtag\(\s*['"]config['"]\s*,\s*['"]G-|google_tag_ids/,
    ids: [/\b(G-[A-Z0-9]{8,12})\b/g],
  },
  {
    name: "Google Ads",
    marketing: true,
    present: /\bAW-\d{8,12}\b|googleadservices\.com/,
    ids: [/\b(AW-\d{8,12})\b/g],
  },
  {
    name: "Google Tag Manager",
    marketing: false,
    present: /googletagmanager\.com\/gtm\.js|\bGTM-[A-Z0-9]{5,9}\b/,
    ids: [/\b(GTM-[A-Z0-9]{5,9})\b/g],
  },
  {
    name: "Meta Pixel",
    marketing: true,
    present: /connect\.facebook\.net|fbq\(|fbevents\.js|\\?"pixel_id\\?"/,
    ids: [/fbq\(\s*['"]init['"]\s*,\s*['"](\d{10,20})/g, /pixel_id\\*"\s*:\s*\\*"(\d{10,20})/g],
  },
  {
    name: "TikTok Pixel",
    marketing: true,
    present: /analytics\.tiktok\.com|ttq\.load|pixelCode/,
    ids: [/ttq\.load\(\s*['"]([A-Z0-9]{15,25})/g, /pixelCode\\*"\s*:\s*\\*"([A-Z0-9]{15,25})/g],
  },
  {
    name: "Pinterest Tag",
    marketing: true,
    present: /pintrk\(|s\.pinimg\.com\/ct\//,
    ids: [/pintrk\(\s*['"]load['"]\s*,\s*['"](\d{10,16})/g],
  },
  { name: "Snapchat Pixel", marketing: true, present: /sc-static\.net\/scevent|snaptr\(/ },
  { name: "Microsoft Ads (UET)", marketing: true, present: /bat\.bing\.com|uetq/ },
  { name: "Reddit Pixel", marketing: true, present: /redditstatic\.com\/ads|rdt\(\s*['"]init/ },
  { name: "X (Twitter) Pixel", marketing: true, present: /static\.ads-twitter\.com|twq\(/ },
  { name: "LinkedIn Insight", marketing: true, present: /snap\.licdn\.com|_linkedin_partner_id/ },
  { name: "Criteo", marketing: true, present: /static\.criteo\.net|criteo_q/ },
];

/** Hosts that are Shopify platform, not third parties. */
export const SHOPIFY_HOST_RE = /(^|\.)(shopify\.com|shopifycdn\.com|shopifycdn\.net|myshopify\.com|shopifysvc\.com|shopifycloud\.com|shop\.app)$/;
