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


  if (name === "list") {

    loadRecruitments();

    setTimeout(
      () => {

        const listPage =
          document.getElementById(
            "listPage"
          );

        if (!listPage) {
          return;
        }

        const headerOffset = 76;

        const top =
          listPage
            .getBoundingClientRect()
            .top
          +
          window.scrollY
          -
          headerOffset;

        window.scrollTo({
          top:
            Math.max(
              0,
              top
            ),
          behavior: "smooth"
        });

      },
      100
    );

  } else {

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }

}
