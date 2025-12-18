Priority pages to inspect & request indexing — Cloud Chicken

Date: 2025-11-10

How to use this list
1. Open Google Search Console for property https://cloudchicken.in
2. In the top search bar use "URL inspection" and paste one page URL at a time.
3. Click "Test Live URL". Wait for rendering to complete.
4. In the "Coverage" / "Indexing" panel check:
   - The canonical shown (should be the same URL, not the homepage)
   - Any crawl/indexing errors or warnings
5. If the canonical and rendered page look correct, click "Request indexing".
6. Wait a few minutes and repeat for the next page. Prioritise high-value pages first.

Notes
- Google can take hours to days to reprocess pages. Don't worry if status doesn't flip immediately.
- If Google still shows "Alternate page with proper canonical" after you request indexing, verify canonical usage and ensure sitemap lists the canonical.
- For dynamic product pages consider adding structured data (Product/Offer schema) and pre-rendering/SSR for speed.

Priority list (copy/paste into Search Console URL inspection)

1) https://cloudchicken.in/
   Priority: Highest
   Why: Homepage, brand authority, primary landing page.
   Action: Test live, verify canonical == '/', request indexing.

2) https://cloudchicken.in/menu
   Priority: Very high
   Why: Primary conversion page (menu / ecommerce). Crucial to appear in search results.
   Action: Test live, verify canonical == '/menu', request indexing.

3) https://cloudchicken.in/login
   Priority: Medium
   Why: Useful for user flows; not critical for search ranking but good to have in index.

4) https://cloudchicken.in/signup
   Priority: Medium
   Why: Important for conversions; confirm canonical.

5) https://cloudchicken.in/cart
   Priority: Medium
   Why: Checkout funnel page — indexing not essential, but OK to have.

6) https://cloudchicken.in/order-tracking
   Priority: Medium
   Why: Transactional page users may search for; ensure canonical.

7) https://cloudchicken.in/about
   Priority: Low-Medium
   Why: Company info — helps local search and brand trust.

8) https://cloudchicken.in/privacy
   Priority: Low
   Why: Legal page — good to index for transparency.

9) https://cloudchicken.in/terms
   Priority: Low
   Why: Legal page.

10) https://cloudchicken.in/contact
    Priority: Low
    Why: Contact / support information (even if stub or handled via WhatsApp float)

Optional (if you have product pages)
- https://cloudchicken.in/product/<slug-or-id>
  Priority: High for product pages; add Product schema and ensure canonical points to the product's canonical path. If product URLs exist, generate a list from your product table and add them to the sitemap.

Batch strategy
- Inspect & request indexing for 5–10 critical pages per day (Search Console may limit rapid requests).
- Inspect homepage + menu first, then legal + auth pages.
- If you use Search Console API via an automated workflow (rare and limited), ensure you respect quota and that pages are ready to index.

Aftercare
- Re-submit sitemap (Search Console → Sitemaps) if you updated canonical behavior or added many new pages.
- Monitor Coverage → Excluded to see if the number of "Alternative page with proper canonical tag" items decreases.
- Use URL Inspection to "View crawled page" and "Rendered HTML" to confirm meta tags and canonical that Google sees.

If you want, I can:
- Generate a CSV of dynamic product pages from your product table (if you provide a DB dump or allow me to run a script locally).
- Prepare a short email/message you can paste into Search Console's "Request indexing" (not required, but useful for team notes).
