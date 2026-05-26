"use client";

import { useEffect } from "react";

function wrapTables(root: ParentNode) {
  root.querySelectorAll("table").forEach((table) => {
    const parent = table.parentElement;
    if (!parent || parent.classList.contains("table-scroll")) return;
    if (
      parent.classList.contains("keyword-table-wrap") ||
      parent.classList.contains("pop-table-wrap") ||
      parent.classList.contains("channel-table-wrap")
    ) {
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "table-scroll";
    parent.insertBefore(wrap, table);
    wrap.appendChild(table);
  });
}

function setupMobileNav(root: ParentNode) {
  root.querySelectorAll(".nav").forEach((nav) => {
    const menu = nav.querySelector(".nav-menu");
    if (!menu || nav.querySelector(".nav-toggle")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-toggle";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "메뉴 열기");
    btn.innerHTML = "<span></span><span></span><span></span>";
    nav.appendChild(btn);

    const setOpen = (open: boolean) => {
      nav.classList.toggle("nav-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    };

    btn.addEventListener("click", () => {
      setOpen(!nav.classList.contains("nav-open"));
    });

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (!link.classList.contains("print")) setOpen(false);
      });
    });

  });
}

export default function ResponsiveEnhancer() {
  useEffect(() => {
    setupMobileNav(document);
    wrapTables(document);

    const onResize = () => {
      document.querySelectorAll(".nav.nav-open").forEach((nav) => {
        if (window.innerWidth > 768) nav.classList.remove("nav-open");
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return null;
}
