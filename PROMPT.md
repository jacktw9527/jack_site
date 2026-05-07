# QR Code Generator Prototype

## System Requirements

Build a dynamic QR code system where:
- Users submit a long URL and get back a short URL token + QR code image
- The QR code encodes a short URL that redirects (302) to the original URL via your server
- Users can modify the target URL after QR code creation
- Users can delete a QR code (soft delete)
- Users can optionally set an expiration timestamp on create or update
- Deleted or expired links return appropriate HTTP status codes
- URL validation: format check, normalization, malicious URL blocking

## Design Questions

Answer these before you start coding:

1. **Static vs Dynamic QR Code:** Why does this system use dynamic QR codes (encode short URL) instead of static (encode original URL directly)? When would you choose static instead?
=> 掃了 Qr Code 後會先打到我的 Server，好處可以處理額外商業邏輯、更新目的地網址、設定 expired、cache、記錄使用者行為。使用 Static 的前提是完全不需要記錄使用者行為、網址永遠不變。

2. **Token Generation:** How will you generate short URL tokens? What happens when two different URLs produce the same token? How does collision probability change as the number of tokens grows?
=> 使用 URL + SecureRamdom 來做網址 hash，降低不同 Url 產出同一個 token 的機會。其實應該要用 User ID 或是 User Secret

3. **Redirect Strategy:** Why 302 (temporary) instead of 301 (permanent)? What are the trade-offs for analytics, URL modification, and latency?
=> 避免瀏覽器 cache 結果，如果之後我要對這個短網址做轉址或是 expired 等後續處理會不方便

4. **URL Normalization:** What normalization rules do you need? Why is `http://Example.com/` and `https://example.com` potentially the same URL?
=> 1.統一小寫 2.http->https 3.去掉首頁 trailing slash '/' 4.port都移除 5.stripe 去除前後多餘空白 6.

5. **Error Semantics:** What should happen when someone scans a deleted link vs a non-existent link? Should the HTTP status codes be different?
=> 不存在回覆404 Not Found, 刪除或是已過期回覆 410 Gone

## Verification

Your prototype should pass all of these:

```bash
# Create a QR code
curl -X POST http://localhost:8000/api/qr/create \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
# → 200, returns {"token": "...", "short_url": "...", "qr_code_url": "...", "original_url": "..."}

# Redirect
curl -o /dev/null -w "%{http_code}" http://localhost:8000/r/{token}
# → 302

# Get info
curl http://localhost:8000/api/qr/{token}
# → 200, returns token metadata

# Update target URL
curl -X PATCH http://localhost:8000/api/qr/{token} \
  -H "Content-Type: application/json" \
  -d '{"url": "https://new-url.com"}'
# → 200

# Redirect now goes to new URL
curl -o /dev/null -w "%{redirect_url}" http://localhost:8000/r/{token}
# → https://new-url.com

# Delete
curl -X DELETE http://localhost:8000/api/qr/{token}
# → 200

# Redirect after delete
curl -o /dev/null -w "%{http_code}" http://localhost:8000/r/{token}
# → 410

# Non-existent token
curl -o /dev/null -w "%{http_code}" http://localhost:8000/r/INVALID
# → 404

# QR code image
# (create a new one first, then)
curl -o /dev/null -w "%{http_code} %{content_type}" http://localhost:8000/api/qr/{token}/image
# → 200 image/png

# Analytics
curl http://localhost:8000/api/qr/{token}/analytics
# → 200, returns {"token": "...", "total_scans": N, "scans_by_day": [...]}
```

## Suggested Tech Stack

Python + FastAPI recommended, but you may use any language/framework.
