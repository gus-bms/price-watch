async function checkStock() {
  const url = "https://www.ralphlauren.co.kr/denim-trucker-jacket-607581.html";
  try {
    const res = await fetch(url, { headers: { "User-Agent": "price-watch/0.1 (+local)" } });
    const html = await res.text();
    
    // Find all size <li> tags that contain the sizes
    const matches = html.match(/<li[^>]*class="[^"]*(?:\bunselectable\b|\bselectable\b|\bselected\b|\bempty\b)[^"]*"[^>]*>[\s\S]*?<\/li>/gi);
    
    if (matches) {
        console.log("Found LI tags with stock info:");
        matches.forEach(li => {
            const size = li.match(/data-selected="([^"]+)"/)?.[1];
            if (size) {
                const className = li.match(/class="([^"]+)"/)?.[1];
                console.log(`Size ${size} -> LI Class: ${className}`);
            }
        });
    }

  } catch (err) {
    console.error(err);
  }
}

checkStock();
