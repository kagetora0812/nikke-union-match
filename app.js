
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

    loadRecruitments();

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
      "Supabaseの設定がまだです。後ほど設定します。",
      "error"
    );

    return;

  }


  const minSlv =
    Number(
      $("#slvFilter").value || 0
    );


  let query = sb
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
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (minSlv) {

    query =
      query.gte(
        "slv",
        minSlv
      );

  }


  const {
    data,
    error
  } = await query;


  if (error) {

    showMessage(
      `読み込みに失敗しました：${error.message}`,
      "error"
    );

    return;

  }


  if (!data || data.length === 0) {

    empty.classList.remove(
      "hidden"
    );

    return;

  }


  list.innerHTML =
    data.map(
      recruitment => `

        <article class="card">

          <div class="card-head">

            <span class="state">
              ● 募集中
            </span>

            <span class="date">
              期限
              ${formatDate(
                recruitment.expires_at
              )}
            </span>

          </div>


          <div class="name">
            ${escapeHtml(
              recruitment.commander_name
            )}
          </div>


          <div class="slv">

            ${escapeHtml(
              recruitment.slv
            )}

            <small>
              SLV
            </small>

          </div>


          <div class="date">

            登録
            ${formatDate(
              recruitment.created_at
            )}

          </div>


          <a
            class="x-btn"
            href="${escapeHtml(
              recruitment.x_url
            )}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Xで募集記事を見る ↗
          </a>

        </article>

      `
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


      const name =
        $("#name")
          .value
          .trim();


      const slv =
        Number(
          $("#slv").value
        );


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
