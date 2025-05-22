import React, { useState } from "react";
import axios from "axios";
import './App.css'

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
  const GROQ_API_KEY = "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"; // Replace with your Groq API key

  const handleSearch = async () => {
    setLoading(true);
    setResults([]);
    try {
      // Step 1: Extract filters from user query using LLM
      const prompt = `You are an AI assistant that extracts structured search filters from e-commerce queries.

Output a valid JSON object using only these allowed fields:
- name
- Color
- min_price
- max_price
- Size
- isOnSale
- condition
- sortColumn
- sortOrder
- page
- pageSize

Rules:
- Include descriptive product keywords (brand, type, color, gender) in the 'name' field as a single string, excluding common stop words like "of", "for", "the", etc.
- The 'Color' should also be present in 'name' and returned separately.
- Convert price values to numbers (not strings).
- Always return 'page' and 'pageSize'. Default to page: 1, pageSize: 50 if not specified.
- If a price condition like "under 50 dollars" is mentioned, set 'max_price': 50.
- Set 'sortColumn': "price" and 'sortOrder': "ASC" for "under"/"below"/"cheaper than" conditions.
- Do not include any fields with null or missing values.
- Return JSON only. No comments or extra formatting.

User query: "${query}"
`;

      const groqRes = await axios.post(
        GROQ_API_URL,
        {
          model: "llama3-70b-8192",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that extracts API filters from user queries.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const rawContent = groqRes.data.choices[0].message.content;
      const filters = JSON.parse(rawContent);

      const cleanedFilters = {};
      for (const [key, value] of Object.entries(filters)) {
        if (value != null) {
          cleanedFilters[key] = value;
        }
      }
      

      // Ensure default page and pageSize
      if (!cleanedFilters.page) cleanedFilters.page = 1;
      if (!cleanedFilters.pageSize) cleanedFilters.pageSize = 50;

      // Build query params for product API
      const queryParams = new URLSearchParams(cleanedFilters);

      // Step 2: Fetch products from FlexOffers API
      const apiResponse = await axios.get(
        `https://api.flexoffers.com/v3/products/full?${queryParams.toString()}`,
        {
          headers: {
            accept: "application/json",
            apiKey: "beb20686-606a-4e92-8c71-bfa967317ddc", // Replace with your API key
          },
        }
      );

      const productList = apiResponse.data;

      // Step 3: Filter product list using LLM again
      // To avoid too large prompt, send only essential product fields
      const minimalProductList = productList.map((p) => ({
        id: p.id || p.productId || null,
        name: p.name,
        brand: p.brand,
        Color: p.Color,
        Size: p.Size,
        price: p.price,
        salePrice: p.salePrice,
        Gender: p.Gender,
        imageUrl:p.imageUrl
      }));

      const filterPrompt = `
You are an AI assistant that filters a list of products based on a user's search query.

User query: "${query}"

Products JSON:
${JSON.stringify(minimalProductList, null, 2)}

Return a JSON array containing only the products that exactly match the user's intent based on color, price, size, brand, and other criteria.

Return JSON only, no extra text.
`;

      const filterResponse = await axios.post(
        GROQ_API_URL,
        {
          model: "llama3-70b-8192",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that filters product lists based on search queries.",
            },
            {
              role: "user",
              content: filterPrompt,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const filteredContent = filterResponse.data.choices[0].message.content;
      const filteredProducts = JSON.parse(filteredContent);

      // Step 4: Update results with filtered products
      setResults(filteredProducts);
    } catch (error) {
      console.error("Search error:", error);
      setResults("Error fetching results. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
  <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
    <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
      Smart Product Search
    </h1>
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="e.g., nike shoe with red color under 300 dollars"
      style={{
        width: "100%",
        padding: "10px",
        borderRadius: "4px",
        border: "1px solid #ccc",
        marginBottom: "10px",
        fontSize: "16px",
      }}
    />
    <button
      onClick={handleSearch}
      disabled={loading || !query.trim()}
      style={{
        backgroundColor: "#2563EB",
        color: "white",
        padding: "10px 20px",
        borderRadius: "4px",
        border: "none",
        cursor: loading || !query.trim() ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
        marginBottom: "20px",
        fontSize: "16px",
      }}
    >
      {loading ? "Searching..." : "Search"}
    </button>

    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px",
        justifyContent: "center",
      }}
    >
      {Array.isArray(results) ? (
        results.length > 0 ? (
          results.map((item, index) => (
            <div
              key={index}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "10px",
                width: "100%",
                maxWidth: "320px",
                boxSizing: "border-box",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "4px", textAlign: "center" }}
              >
                {item.name}
              </div>
              <div style={{ fontSize: "12px", color: "#666", textAlign: "center" }}>
                {item.brand} - {item.catalogName || ""}
              </div>
              <div style={{ fontSize: "14px", marginTop: "4px" }}>
                Price: {item.priceCurrency || "$"} {item.price}
              </div>
              {item.salePrice > 0 && (
                <div style={{ fontSize: "14px", color: "green" }}>
                  Sale Price: {item.priceCurrency || "$"} {item.salePrice}
                </div>
              )}
              <div style={{ fontSize: "12px", marginTop: "4px" }}>
                Color: {item.Color || "-"}, Size: {item.Size || "-"}, Gender:{" "}
                {item.Gender || "-"}
              </div>
              <div style={{ fontSize: "12px", marginTop: "4px", textAlign: "center" }}>
                {item.shortDescription || ""}
              </div>
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  style={{
                    width: "100%",
                    maxWidth: "150px",
                    height: "150px",
                    objectFit: "contain",
                    margin: "10px 0",
                  }}
                />
              )}
              {item.linkUrl && (
                <a
                  href={item.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#2563EB",
                    textDecoration: "underline",
                    fontSize: "14px",
                    textAlign: "center",
                  }}
                >
                  View Product
                </a>
              )}
            </div>
          ))
        ) : (
          <div>No results found</div>
        )
      ) : (
        <pre
          style={{
            backgroundColor: "#f5f5f5",
            padding: "10px",
            borderRadius: "4px",
            width: "100%",
            overflowX: "auto",
          }}
        >
          {results || "Results will appear here..."}
        </pre>
      )}
    </div>
  </div>
);

}
