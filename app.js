/*
  NIKKE UNION MATCH
  v3
*/


// ========================================
// Supabase
// ========================================

const SUPABASE_URL =
  "https://igoekrvpgnjberppiawf.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_xSjnNTnh667o9IesU5g5Kw_xcdg9bbh";


const sb =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );


// ========================================
// 共通
// ========================================

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

    const url =
      new URL(value);

    return [
      "x.com",
      "www.x.com",
      "twitter.com",
      "www.twitter.com"
    ].includes(
      url.hostname
    );

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
  ).format(
    new Date(date)
  );

}


// ========================================
// PASS生成
// 8文字
// ========================================

function generatePass() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const random =
    new Uint32Array(8);

  crypto.getRandomValues(
    random
  );

  return Array.from(
    random,
    number =>
      chars[
        number % chars.length
      ]
  ).join("");

}


// ========================================
// PASSハッシュ
// ========================================

async function sha256(text) {

  const data =
    new TextEncoder()
      .encode(text);

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


// ========================================
// X投稿ID取得
// ========================================

function getXPostId(url) {

  try {

    const parsed =
      new URL(url);

    const match =
      parsed.pathname.match(
        /\/status\/(\d+)/
      );

    return match
      ? match[1]
      : null;

  } catch {

    return null;

  }

}


// ========================================
// X投稿埋め込み
// ========================================

async function renderXEmbeds(
  retry = 0
) {

  if (
    !window.twttr ||
    !window.twttr.widgets
  ) {

    if (retry < 10) {

      setTimeout(
        () => {
          renderXEmbeds(
            retry + 1
          );
        },
        500
      );

    }

    return;

  }


  const targets =
    document.querySelectorAll(
      ".x-embed"
    );


  for (
    const target of targets
  ) {

    if (
      target.dataset.loaded ===
      "true"
    ) {

      continue;

    }


    const postId =
      target.dataset.postId;


    if (!postId) {

      target.innerHTML =
        '<div class="x-embed-error">X投稿を表示できません</div>';

      continue;

    }


    target.dataset.loaded =
      "true";


    try {

      await window.twttr.widgets
        .createTweet(
          postId,
          target,
          {
            theme: "dark",
            align: "center",
            conversation: "none"
          }
        );

    } catch (error) {

      console.error(
        "X投稿表示エラー",
        error
      );

    }

  }

}


// ========================================
// ページ切替
// ========================================

function showPage(name) {

  document
    .querySelectorAll(".page")
    .forEach(page => {

      page.classList.remove(
        "active"
      );

    });


  const page =
    document.getElementById(
      `${name}Page`
    );


  if (page) {

    page.classList.add(
      "active"
    );

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


// ========================================
// 指揮官 / ユニオン検索タブ
// ========================================

let currentSearchType =
  "commander";


const commanderSearchTab =
  $("#commanderSearchTab");

const unionSearchTab =
  $("#unionSearchTab");

const commanderFilterBox =
  $("#commanderFilterBox");

const unionFilterBox =
  $("#unionFilterBox");


function setSearchType(type) {

  currentSearchType =
    type;


  const isCommander =
    type === "commander";


  commanderSearchTab
    ?.classList
    .toggle(
      "active",
      isCommander
    );


  unionSearchTab
    ?.classList
    .toggle(
      "active",
      !isCommander
    );


  commanderFilterBox
    ?.classList
    .toggle(
      "hidden",
      !isCommander
    );


  unionFilterBox
    ?.classList
    .toggle(
      "hidden",
      isCommander
    );


  loadRecruitments();

}


commanderSearchTab
  ?.addEventListener(
    "click",
    () => {

      setSearchType(
        "commander"
      );

    }
  );


unionSearchTab
  ?.addEventListener(
    "click",
    () => {

      setSearchType(
        "union"
      );

    }
  );


// ========================================
// カウントダウン
// ========================================

let countdownTimer =
  null;


function getRemainingTime(
  expiresAt
) {

  const diff =
    new Date(
      expiresAt
    ).getTime()
    -
    Date.now();


  if (diff <= 0) {

    return {
      expired: true,
      text: "掲載終了",
      className: "danger"
    };

  }


  const totalMinutes =
    Math.floor(
      diff / 60000
    );


  const days =
    Math.floor(
      totalMinutes / 1440
    );


  const hours =
    Math.floor(
      (
        totalMinutes % 1440
      ) / 60
    );


  const minutes =
    totalMinutes % 60;


  let className =
    "";


  if (days <= 2) {

    className =
      "danger";

  } else if (days <= 6) {

    className =
      "warning";

  }


  return {

    expired: false,

    text:
      `⏳ 残り ${days}日 ${hours}時間 ${minutes}分`,

    className

  };

}


function updateCountdowns() {

  document
    .querySelectorAll(
      "[data-expires]"
    )
    .forEach(element => {

      const result =
        getRemainingTime(
          element.dataset.expires
        );


      if (result.expired) {

        const card =
          element.closest(
            ".card"
          );


        if (card) {

          card.remove();

        }


        return;

      }


      element.textContent =
        result.text;


      element.className =
        `countdown ${result.className}`;

    });

}


// ========================================
// 空表示
// ========================================

function showEmpty(text) {

  const empty =
    $("#emptyState");


  if (!empty) {

    return;

  }


  empty.classList.remove(
    "hidden"
  );


  const p =
    empty.querySelector("p");


  if (p) {

    p.textContent =
      text;

  }

}


// ========================================
// メッセージ
// ========================================

function showMessage(
  text,
  type = ""
) {

  const message =
    $("#message");


  if (!message) {

    return;

  }


  message.textContent =
    text;

  message.className =
    `message ${type}`;

}


// ========================================
// 募集一覧
// ========================================

async function loadRecruitments() {

  const list =
    $("#recruitmentList");

  const empty =
    $("#emptyState");


  if (!list || !empty) {

    return;

  }


  list.innerHTML =
    "";


  empty.classList.add(
    "hidden"
  );


  // --------------------------------
  // 指揮官取得
  // --------------------------------

  const commanderQuery =
    sb
      .from(
        "recruitments"
      )
      .select(
        "id, commander_name, slv, x_url, created_at, expires_at"
      )
      .eq(
        "status",
        "open"
      )
      .gt(
        "expires_at",
        new Date()
          .toISOString()
      );


  // --------------------------------
  // ユニオン取得
  // --------------------------------

  const unionQuery =
    sb
      .from(
        "union_recruitments"
      )
      .select(
        "id, union_name, union_rank, x_url, created_at, expires_at"
      )
      .eq(
        "status",
        "open"
      )
      .gt(
        "expires_at",
        new Date()
          .toISOString()
      );


  const [
    commanderResult,
    unionResult
  ] =
    await Promise.all([
      commanderQuery,
      unionQuery
    ]);


  if (
    commanderResult.error
  ) {

    showMessage(
      `指揮官読み込みエラー：${commanderResult.error.message}`,
      "error"
    );

    return;

  }


  if (
    unionResult.error
  ) {

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


  // ========================================
  // 総数
  // ========================================

  if (
    $("#commanderCountTop")
  ) {

    $("#commanderCountTop")
      .textContent =
      commanders.length;

  }


  if (
    $("#unionCountTop")
  ) {

    $("#unionCountTop")
      .textContent =
      unions.length;

  }


  if (
    $("#commanderCount")
  ) {

    $("#commanderCount")
      .textContent =
      commanders.length;

  }


  if (
    $("#unionCount")
  ) {

    $("#unionCount")
      .textContent =
      unions.length;

  }


  // ========================================
  // 最終更新
  // ========================================

  if (
    $("#lastUpdated")
  ) {

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


  // ========================================
  // 指揮官一覧
  // ========================================

  if (
    currentSearchType ===
    "commander"
  ) {

    const minSlv =
      Number(
        $("#slvFilter")
          ?.value ||
        0
      );


    let filtered =
      commanders;


if (minSlv) {

  filtered =
    commanders.filter(
      item => {

        const slv =
          Number(item.slv);

        // 1000以上
        if (minSlv === 1000) {
          return slv >= 1000;
        }

        // 100刻み
        return (
          slv >= minSlv &&
          slv < minSlv + 100
        );

      }
    );

}


    filtered.sort(
      (a, b) =>
        new Date(
          b.created_at
        )
        -
        new Date(
          a.created_at
        )
    );


    if (
      filtered.length === 0
    ) {

      showEmpty(
        "現在募集中の指揮官はいません。"
      );

      return;

    }


    list.innerHTML =
      filtered
        .map(
          item => {

            const remaining =
              getRemainingTime(
                item.expires_at
              );


            const postId =
              getXPostId(
                item.x_url
              );


            return `

              <article
                class="card commander-card"
              >

                <div class="card-head">

                  <span
                    class="recruitment-type"
                  >
                    ● 指揮官
                  </span>

                  <span class="date">

                    期限
                    ${formatDate(
                      item.expires_at
                    )}

                  </span>

                </div>


                <div class="name">

                  ${escapeHtml(
                    item.commander_name
                  )}

                </div>


                <div class="slv">

                  ${escapeHtml(
                    item.slv
                  )}

                  <small>
                    SLV
                  </small>

                </div>


                <div
                  class="countdown ${remaining.className}"
                  data-expires="${escapeHtml(
                    item.expires_at
                  )}"
                >

                  ${remaining.text}

                </div>


                <div
                  class="x-post-area"
                >

                  <div
                    class="x-embed"
                    data-post-id="${escapeHtml(
                      postId || ""
                    )}"
                  >
                  </div>


                  <a
                    class="x-btn"
                    href="${escapeHtml(
                      item.x_url
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Xで投稿を開く ↗
                  </a>

                </div>

              </article>

            `;

          }
        )
        .join("");

  }


  // ========================================
  // ユニオン一覧
  // ========================================

  if (
    currentSearchType ===
    "union"
  ) {

    const selectedRank =
      $("#unionRankFilter")
        ?.value ||
      "";


    let filtered =
      unions;


    if (selectedRank) {

      filtered =
        unions.filter(
          item =>
            item.union_rank ===
            selectedRank
        );

    }


    filtered.sort(
      (a, b) =>
        new Date(
          b.created_at
        )
        -
        new Date(
          a.created_at
        )
    );


    if (
      filtered.length === 0
    ) {

      showEmpty(
        "現在募集中のユニオンはいません。"
      );

      return;

    }


    list.innerHTML =
      filtered
        .map(
          item => {

            const remaining =
              getRemainingTime(
                item.expires_at
              );


            const postId =
              getXPostId(
                item.x_url
              );


            return `

              <article
                class="card union-card"
              >

                <div class="card-head">

                  <span
                    class="recruitment-type"
                  >
                    ● ユニオン
                  </span>

                  <span class="date">

                    期限
                    ${formatDate(
                      item.expires_at
                    )}

                  </span>

                </div>


                <div class="name">

                  ${escapeHtml(
                    item.union_name
                  )}

                </div>


                <div class="union-rank">

                  ${escapeHtml(
                    item.union_rank
                  )}

                </div>


                <div
                  class="countdown ${remaining.className}"
                  data-expires="${escapeHtml(
                    item.expires_at
                  )}"
                >

                  ${remaining.text}

                </div>


                <div
                  class="x-post-area"
                >

                  <div
                    class="x-embed"
                    data-post-id="${escapeHtml(
                      postId || ""
                    )}"
                  >
                  </div>


                  <a
                    class="x-btn"
                    href="${escapeHtml(
                      item.x_url
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Xで投稿を開く ↗
                  </a>

                </div>

              </article>

            `;

          }
        )
        .join("");

  }


  updateCountdowns();

  renderXEmbeds();


  if (
    countdownTimer
  ) {

    clearInterval(
      countdownTimer
    );

  }


  countdownTimer =
    setInterval(
      updateCountdowns,
      60000
    );

}


// ========================================
// フィルター
// ========================================

$("#slvFilter")
  ?.addEventListener(
    "change",
    loadRecruitments
  );


$("#unionRankFilter")
  ?.addEventListener(
    "change",
    loadRecruitments
  );


$("#refreshBtn")
  ?.addEventListener(
    "click",
    loadRecruitments
  );


// ========================================
// 登録タイプ切替
// ========================================

const registrationTypeSelect =
  $("#registrationType");

const commanderFields =
  $("#commanderFields");

const unionFields =
  $("#unionFields");


function updateRegistrationFields() {

  if (
    !registrationTypeSelect
  ) {

    return;

  }


  const isUnion =
    registrationTypeSelect
      .value ===
    "union";


  commanderFields
    ?.classList
    .toggle(
      "hidden",
      isUnion
    );


  unionFields
    ?.classList
    .toggle(
      "hidden",
      !isUnion
    );


  const name =
    $("#name");

  const slv =
    $("#slv");

  const unionName =
    $("#unionName");


  if (name) {

    name.required =
      !isUnion;

  }


  if (slv) {

    slv.required =
      !isUnion;

  }


  if (unionName) {

    unionName.required =
      isUnion;

  }

}


registrationTypeSelect
  ?.addEventListener(
    "change",
    updateRegistrationFields
  );


updateRegistrationFields();


// ========================================
// 登録完了表示
// ========================================

function showRegistrationResult(
  pass,
  result
) {

  if (
    $("#passValue")
  ) {

    $("#passValue")
      .textContent =
      pass;

  }


  if (
    $("#resultExpiry")
  ) {

    $("#resultExpiry")
      .textContent =
      formatDate(
        result.expires_at
      );

  }


  // 古いHTMLに募集ID欄が残っている場合は隠す

  const idElement =
    $("#resultId");


  if (idElement) {

    const row =
      idElement.closest(
        ".result-row"
      );


    if (row) {

      row.style.display =
        "none";

    }

  }


  $("#resultModal")
    ?.classList
    .remove(
      "hidden"
    );

}


// ========================================
// 募集登録
// ========================================

$("#registerForm")
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const type =
        $("#registrationType")
          ?.value ||
        "commander";


      const xUrl =
        $("#xUrl")
          .value
          .trim();


      if (
        !validXUrl(xUrl)
      ) {

        alert(
          "Xの記事URLを入力してください。"
        );

        return;

      }


      // ====================================
      // PASS重複時は最大5回まで再生成
      // ====================================

      for (
        let attempt = 0;
        attempt < 5;
        attempt++
      ) {

        const pass =
          generatePass();


        const passHash =
          await sha256(
            pass
          );


        // ==================================
        // ユニオン登録
        // ==================================

        if (
          type ===
          "union"
        ) {

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


          const {
            data,
            error
          } =
            await sb.rpc(
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

            if (
              error.message
                ?.includes(
                  "PASS_DUPLICATE"
                )
            ) {

              continue;

            }


            alert(
              `登録に失敗しました：${error.message}`
            );

            return;

          }


          const result =
            Array.isArray(data)
              ? data[0]
              : data;


          showRegistrationResult(
            pass,
            result
          );


          event.target.reset();

          updateRegistrationFields();

          return;

        }


        // ==================================
        // 指揮官登録
        // ==================================

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


        if (
          !slv ||
          slv < 1 ||
          slv > 1200
        ) {

          alert(
            "SLVは1～1200で入力してください。"
          );

          return;

        }


        const {
          data,
          error
        } =
          await sb.rpc(
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

          if (
            error.message
              ?.includes(
                "PASS_DUPLICATE"
              )
          ) {

            continue;

          }


          alert(
            `登録に失敗しました：${error.message}`
          );

          return;

        }


        const result =
          Array.isArray(data)
            ? data[0]
            : data;


        showRegistrationResult(
          pass,
          result
        );


        event.target.reset();

        updateRegistrationFields();

        return;

      }


      alert(
        "PASSの発行に失敗しました。もう一度登録してください。"
      );

    }
  );


// ========================================
// PASSコピー
// ========================================

$("#copyPass")
  ?.addEventListener(
    "click",
    async () => {

      await navigator
        .clipboard
        .writeText(
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


// ========================================
// モーダル
// ========================================

function closeModal() {

  $("#resultModal")
    ?.classList
    .add(
      "hidden"
    );

}


$("#modalClose")
  ?.addEventListener(
    "click",
    closeModal
  );


$("#resultDone")
  ?.addEventListener(
    "click",
    () => {

      closeModal();

      showPage(
        "list"
      );

    }
  );


// ========================================
// PASSだけで募集締切
// ========================================

$("#closeForm")
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const pass =
        $("#closePass")
          .value
          .trim()
          .toUpperCase();


      if (!pass) {

        alert(
          "PASSを入力してください。"
        );

        return;

      }


      const hash =
        await sha256(
          pass
        );


      const {
        data,
        error
      } =
        await sb.rpc(
          "close_recruitment_by_pass",
          {
            p_pass_hash:
              hash
          }
        );


      if (error) {

        console.error(
          error
        );


        alert(
          "募集締切処理に失敗しました。"
        );

        return;

      }


      if (
        data ===
        "commander"
      ) {

        alert(
          "指揮官募集を締め切りました。"
        );


        event.target.reset();


        showPage(
          "list"
        );


        return;

      }


      if (
        data ===
        "union"
      ) {

        alert(
          "ユニオン募集を締め切りました。"
        );


        event.target.reset();


        showPage(
          "list"
        );


        return;

      }


      alert(
        "PASSが正しくないか、すでに募集終了しています。"
      );

    }
  );


// ========================================
// 起動
// ========================================

setSearchType(
  "commander"
);
