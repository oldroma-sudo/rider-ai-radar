(function () {
  let payloadPromise;

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/^中国/, "")
      .replace(/[\s·,，.。/\\\-—_]+/g, "");
  }

  function compact(value) {
    return normalize(value).replace(
      /(特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|自治州|自治县|街道办事处|街道|新区|地区|盟|省|市|区|县|旗|乡|镇)$/u,
      "",
    );
  }

  async function load() {
    if (!payloadPromise) {
      payloadPromise = fetch("./china-divisions-manifest.json")
        .then(function (response) {
          if (!response.ok) throw new Error("division manifest unavailable");
          return response.json();
        })
        .then(function (manifest) {
          return Promise.all(
            manifest.parts.map(function (part) {
              return fetch("./" + part).then(function (response) {
                if (!response.ok) throw new Error("division chunk unavailable");
                return response.json();
              });
            }),
          ).then(function (chunks) {
            return { meta: manifest.meta, rows: chunks.flat() };
          });
        })
        .catch(function () {
          return fetch("./china-divisions.min.json").then(function (response) {
            if (!response.ok) throw new Error("division data unavailable");
            return response.json();
          });
        });
    }
    return payloadPromise;
  }

  function search(rows, query) {
    const byId = new Map(rows.map(function (row) { return [row[0], row]; }));
    const normalizedQuery = normalize(query);
    const compactQuery = compact(query);
    const candidates = [];

    rows.forEach(function (row) {
      const path = [];
      let current = row;
      while (current) {
        path.unshift(current);
        current = byId.get(current[1]);
      }
      const names = path.map(function (item) { return item[4] || item[3]; });
      const uniqueNames = names.filter(function (name, index) {
        return index === 0 || name !== names[index - 1];
      });
      const label = uniqueNames.join(" · ");
      const full = normalize(names.join(""));
      const official = normalize(row[4] || row[3]);
      const short = compact(row[3]);
      let score = 0;

      if (full === normalizedQuery) score = 150;
      else if (official === normalizedQuery) score = 125;
      else if (normalize(row[3]) === normalizedQuery) score = 122;
      else if (short && short === compactQuery) score = 112;
      else if (full.endsWith(normalizedQuery)) score = 104;
      else if (full.includes(normalizedQuery)) score = 88;
      else if (normalizedQuery.includes(full)) score = 84;
      else if (compactQuery.length >= 2 && compact(names.join("")).includes(compactQuery)) score = 65;

      if (score > 0) candidates.push({ row: row, path: path, label: label, score: score + row[2] * 0.01 });
    });

    return candidates
      .sort(function (left, right) { return right.score - left.score || right.row[2] - left.row[2]; })
      .filter(function (candidate, index, all) {
        return all.findIndex(function (item) { return item.label === candidate.label; }) === index;
      })
      .slice(0, 8);
  }

  async function coordinate(candidate) {
    const searchOrder = candidate.path
      .slice()
      .reverse()
      .filter(function (row) { return row[2] >= 1; })
      .map(function (row) { return row[4] || row[3]; })
      .filter(function (name, index, all) { return all.indexOf(name) === index; });
    const province = candidate.path.find(function (row) { return row[2] === 0; });
    const city = candidate.path.find(function (row) { return row[2] === 1; });

    for (const name of searchOrder) {
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.searchParams.set("name", name);
      url.searchParams.set("count", "20");
      url.searchParams.set("language", "zh");
      url.searchParams.set("format", "json");
      url.searchParams.set("countryCode", "CN");
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      const results = Array.isArray(data.results) ? data.results : [];
      const place = results
        .map(function (result) {
          const searchable = normalize([
            result.name,
            result.admin1,
            result.admin2,
            result.admin3,
            result.admin4,
          ].filter(Boolean).join(""));
          let score = 0;
          if (province && searchable.includes(compact(province[3]))) score += 3;
          if (city && searchable.includes(compact(city[3]))) score += 4;
          if (searchable.includes(compact(name))) score += 6;
          return { result: result, score: score };
        })
        .sort(function (left, right) { return right.score - left.score; })[0];
      if (
        place &&
        place.score >= 3 &&
        Number.isFinite(place.result.latitude) &&
        Number.isFinite(place.result.longitude)
      ) {
        return {
          latitude: place.result.latitude,
          longitude: place.result.longitude,
          matchedName: name,
        };
      }
    }
    throw new Error("coordinate not found");
  }

  window.RiderChinaLocations = {
    compact: compact,
    load: load,
    search: search,
    coordinate: coordinate,
  };
})();
