
/*
  NIKKE UNION MATCH
  v1
*/

const SUPABASE_URL = "https://igoekrvpgnjberppiawf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xSjnNTnh667o9IesU5g5Kw_xcdg9bbh";

const hasSupabaseConfig =
  !SUPABASE_URL.includes("YOUR_") &&
  !SUPABASE_ANON_KEY.includes("YOUR_");

const sb = hasSupabaseConfig
  ? window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    )
  : null;


// --------------------------------
// 共通
// --------------------------------

const $ = (selector) =>
  document.querySelector(selector);


function escapeHtml(value) {

  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char])
  );

}


function validXUrl(value) {

  try {

    const url = new URL(value);

    return [
      "x.com",
      "www.x.com",
      "twitter.com",
      "www.twitter.com"
    ].includes(url.hostname);

  } catch {

    return false;

  }

}


function formatDate(date) {

  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(new Date(date));

}


function generatePass() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const random =
    new Uint32Array(6);

  crypto.getRandomValues(random);

  return Array.from(
    random,
    number => chars[number % chars.length]
  ).join("");

}


async function sha256(text) {

  const data =
    new TextEncoder().encode(text);

  const hash =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return Array.from(
    new Uint8Array(hash)
  )
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(2, "0")
    )
    .join("");

}


// --------------------------------
// ページ切り替え
// --------------------------------

function showPage(name) {

  document
    .querySelectorAll(".page")
    .forEach(page => {

      page.classList.remove("active");

    });


  const page =
    document.getElementById(
      `${name}Page`
    );

  if (page) {

    page.classList.add("active");

  }


  document
    .querySelectorAll(".nav-btn")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === name
      );

    });


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  if (name === "list") {

    async function const list =();

  }

}


document
  .querySelectorAll("[data-page]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        showPage(
          button.dataset.page
        );

      }
    );

  });


// --------------------------------
// 募集一覧
// --------------------------------

async function loadRecruitments() {

  const list =
    $("#recruitmentList");

  const empty =
    $("#emptyState");


  list.innerHTML = "";

  empty.classList.add(
    "hidden"
  );


  if (!sb) {

    showMessage(
      "Supabaseの設定がありません。",
      "error"
    );

    return;

  }


  const minSlv =
    Number(
      $("#slvFilter")?.value || 0
    );


  // ------------------------------
  // 指揮官
  // ------------------------------

  let commanderQuery = sb
    .from("recruitments")
    .select(
      "id, commander_name, slv, x_url, created_at, expires_at"
    )
    .eq(
      "status",
      "open"
    )
    .gt(
      "expires_at",
      new Date().toISOString()
    );


  if (minSlv) {

    commanderQuery =
      commanderQuery.gte(
        "slv",
        minSlv
      );

  }


  // ------------------------------
  // ユニオン
  // ------------------------------

  const unionQuery = sb
    .from("union_recruitments")
    .select(
      "id, union_name, union_rank, x_url, created_at, expires_at"
    )
    .eq(
      "status",
      "open"
    )
    .gt(
      "expires_at",
      new Date().toISOString()
    );


  // ------------------------------
  // 両方読み込み
  // ------------------------------

  const [
    commanderResult,
    unionResult
  ] = await Promise.all([
    commanderQuery,
    unionQuery
  ]);


  if (commanderResult.error) {

    showMessage(
      `指揮官読み込みエラー：${commanderResult.error.message}`,
      "error"
    );

    return;

  }


  if (unionResult.error) {

    showMessage(
      `ユニオン読み込みエラー：${unionResult.error.message}`,
      "error"
    );

    return;

  }


  const commanders =
    commanderResult.data || [];


  const unions =
    unionResult.data || [];


  // ------------------------------
  // 上部総数
  // ------------------------------

  if ($("#commanderCountTop")) {

    $("#commanderCountTop")
      .textContent =
      commanders.length;

  }


  if ($("#unionCountTop")) {

    $("#unionCountTop")
      .textContent =
      unions.length;

  }


  if ($("#commanderCount")) {

    $("#commanderCount")
      .textContent =
      commanders.length;

  }


  if ($("#unionCount")) {

    $("#unionCount")
      .textContent =
      unions.length;

  }


  if ($("#lastUpdated")) {

    $("#lastUpdated")
      .textContent =
      "最終更新：" +
      new Intl.DateTimeFormat(
        "ja-JP",
        {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }
      ).format(
        new Date()
      );

  }


  // ------------------------------
  // 指揮官を共通形式へ
  // ------------------------------

  const commanderItems =
    commanders.map(
      item => ({
        type: "commander",
        name: item.commander_name,
        slv: item.slv,
        xUrl: item.x_url,
        createdAt: item.created_at,
        expiresAt: item.expires_at
      })
    );


  // ------------------------------
  // ユニオンを共通形式へ
  // ------------------------------

  const unionItems =
    unions.map(
      item => ({
        type: "union",
        name: item.union_name,
        rank: item.union_rank,
        xUrl: item.x_url,
        createdAt: item.created_at,
        expiresAt: item.expires_at
      })
    );


  // ------------------------------
  // 混合して新着順
  // ------------------------------

  const allItems = [
    ...commanderItems,
    ...unionItems
  ].sort(
    (a, b) =>
      new Date(b.createdAt) -
      new Date(a.createdAt)
  );


  if (allItems.length === 0) {

    empty.classList.remove(
      "hidden"
    );

    const p =
      empty.querySelector("p");

    if (p) {
      p.textContent =
        "現在募集中の指揮官・ユニオンはいません。";
    }

    return;

  }


  // ------------------------------
  // 一覧表示
  // ------------------------------

  list.innerHTML =
    allItems.map(
      item => {

        if (item.type === "commander") {

          return `

            <article class="card commander-card">

              <div class="card-head">

                <span class="recruitment-type">
                  ● 指揮官
                </span>

              </div>


              <div class="name">
                ${escapeHtml(item.name)}
              </div>


              <div class="slv">
                SLV ${escapeHtml(item.slv)}
              </div>


              <a
                class="x-btn"
                href="${escapeHtml(item.xUrl)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Xで募集記事を見る ↗
              </a>

            </article>

          `;

        }


        return `

          <article class="card union-card">

            <div class="card-head">

              <span class="recruitment-type">
                ● ユニオン
              </span>

            </div>


            <div class="name">
              ${escapeHtml(item.name)}
            </div>


            <div class="union-rank">
              ${escapeHtml(item.rank)}
            </div>


            <a
              class="x-btn"
              href="${escapeHtml(item.xUrl)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Xで募集記事を見る ↗
            </a>

          </article>

        `;

      }
    ).join("");

}

$("#slvFilter")
  .addEventListener(
    "change",
    loadRecruitments
  );


$("#refreshBtn")
  .addEventListener(
    "click",
    loadRecruitments
  );


// --------------------------------
// メッセージ
// --------------------------------

function showMessage(
  text,
  type = ""
) {

  const message =
    $("#message");

  message.textContent =
    text;

  message.className =
    `message ${type}`;

}


// --------------------------------
// 募集登録
// --------------------------------
// --------------------------------
// 登録タイプ切り替え
// --------------------------------

const registrationType =
  $("#registrationType");

const commanderFields =
  $("#commanderFields");

const unionFields =
  $("#unionFields");


if (registrationType) {

  registrationType.addEventListener(
    "change",
    () => {

      const isUnion =
        registrationType.value === "union";

      if (commanderFields) {
        commanderFields.classList.toggle(
          "hidden",
          isUnion
        );
      }

      if (unionFields) {
        unionFields.classList.toggle(
          "hidden",
          !isUnion
        );
      }

      const name =
        $("#name");

      const slv =
        $("#slv");

      const unionName =
        $("#unionName");

      if (name) {
        name.required = !isUnion;
      }

      if (slv) {
        slv.required = !isUnion;
      }

      if (unionName) {
        unionName.required = isUnion;
      }

    }
  );

}


// --------------------------------
// 募集登録
// --------------------------------

$("#registerForm")
$("#registerForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (!sb) {

        alert(
          "Supabaseの設定がまだです。"
        );

        return;

      }


const registrationType =
  $("#registrationType").value;

const xUrl =
  $("#xUrl")
    .value
    .trim();


if (!validXUrl(xUrl)) {

  alert(
    "Xの記事URLを入力してください。"
  );

  return;

}


// --------------------------------
// ユニオン登録
// --------------------------------

if (registrationType === "union") {

  const unionName =
    $("#unionName")
      .value
      .trim();

  const unionRank =
    $("#unionRank")
      .value;


  if (!unionName) {

    alert(
      "ユニオン名を入力してください。"
    );

    return;

  }


  const pass =
    generatePass();


  const passHash =
    await sha256(
      pass
    );


  const {
    data,
    error
  } = await sb.rpc(
    "create_union_recruitment",
    {
      p_union_name:
        unionName,

      p_union_rank:
        unionRank,

      p_x_url:
        xUrl,

      p_pass_hash:
        passHash
    }
  );


  if (error) {

    alert(
      `登録に失敗しました：${error.message}`
    );

    return;

  }


  const result =
    Array.isArray(data)
      ? data[0]
      : data;


  $("#passValue")
    .textContent =
    pass;


  $("#resultId")
    .textContent =
    result.id;


  $("#resultExpiry")
    .textContent =
    formatDate(
      result.expires_at
    );


  $("#resultModal")
    .classList
    .remove("hidden");


  event.target.reset();

  return;

}


// --------------------------------
// 指揮官登録
// --------------------------------

const name =
  $("#name")
    .value
    .trim();


const slv =
  Number(
    $("#slv").value
  );


if (!name) {

  alert(
    "指揮官名を入力してください。"
  );

  return;

}


if (!slv || slv < 1 || slv > 1200) {

  alert(
    "SLVは1～1200で入力してください。"
  );

  return;

}

        alert(
          "Xの記事URLを入力してください。"
        );

        return;

      }


      const pass =
        generatePass();


      const passHash =
        await sha256(
          pass
        );


      const {
        data,
        error
      } = await sb.rpc(
        "create_recruitment",
        {
          p_commander_name:
            name,

          p_slv:
            slv,

          p_x_url:
            xUrl,

          p_pass_hash:
            passHash
        }
      );


      if (error) {

        alert(
          `登録に失敗しました：${error.message}`
        );

        return;

      }


      const result =
        Array.isArray(data)
          ? data[0]
          : data;


      $("#passValue")
        .textContent =
        pass;


      $("#resultId")
        .textContent =
        result.id;


      $("#resultExpiry")
        .textContent =
        formatDate(
          result.expires_at
        );


      $("#resultModal")
        .classList
        .remove("hidden");


      event.target.reset();

    }
  );


// --------------------------------
// PASSコピー
// --------------------------------

$("#copyPass")
  .addEventListener(
    "click",
    async () => {

      await navigator.clipboard.writeText(
        $("#passValue")
          .textContent
      );


      $("#copyPass")
        .textContent =
        "コピーしました";


      setTimeout(
        () => {

          $("#copyPass")
            .textContent =
            "PASSをコピー";

        },
        1500
      );

    }
  );


// --------------------------------
// モーダル
// --------------------------------

function closeModal() {

  $("#resultModal")
    .classList
    .add("hidden");

}


$("#modalClose")
  .addEventListener(
    "click",
    closeModal
  );


$("#resultDone")
  .addEventListener(
    "click",
    () => {

      closeModal();

      showPage(
        "list"
      );

    }
  );


// --------------------------------
// 募集締切
// --------------------------------

$("#closeForm")
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (!sb) {

        alert(
          "Supabaseの設定がまだです。"
        );

        return;

      }


      const id =
        $("#closeId")
          .value
          .trim();


      const pass =
        $("#closePass")
          .value
          .trim();


      if (!id || !pass) {

        return;

      }


      const hash =
        await sha256(
          pass
        );


      const {
        data,
        error
      } = await sb.rpc(
        "close_recruitment",
        {
          p_id: id,
          p_pass_hash: hash
        }
      );


      if (error) {

        alert(
          `処理に失敗しました：${error.message}`
        );

        return;

      }


      if (!data) {

        alert(
          "募集IDまたはPASSが正しくありません。"
        );

        return;

      }


      alert(
        "募集を締め切りました。"
      );


      event.target.reset();


      showPage(
        "list"
      );

    }
  );


// --------------------------------
// 起動
// --------------------------------

loadRecruitments();
