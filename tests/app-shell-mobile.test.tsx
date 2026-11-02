import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { AppShell } from "@/components/layout";
import { navItems } from "@/components/layout/nav-items";
import { m } from "@/messages";

import { restoreMatchMedia, setViewportWidth } from "./support/match-media";

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<p>الصفحة الرئيسية</p>} />
          <Route path="products" element={<p>صفحة المنتجات</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  restoreMatchMedia();
});

describe("AppShell navigation on a phone", () => {
  it("has a menu button that opens the same navigation the desktop sidebar shows", () => {
    setViewportWidth(375);
    renderShell();

    // The desktop sidebar is hidden by CSS below lg; the button is the way in.
    const trigger = screen.getByRole("button", { name: m.nav.openMenu });
    expect(trigger).toBeInTheDocument();
    const sidebar = screen.getByRole("complementary");
    const sidebarLabels = within(sidebar)
      .getAllByRole("link")
      .map((link) => link.textContent);

    fireEvent.click(trigger);
    const sheet = screen.getByRole("dialog");
    const sheetLabels = within(sheet)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(sheetLabels).toEqual(navItems.map((item) => item.label));
    expect(sheetLabels).toEqual(sidebarLabels);
  });

  it("navigates through the sheet and closes it", () => {
    setViewportWidth(375);
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: m.nav.openMenu }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("link", {
        name: m.nav.products,
      }),
    );
    expect(screen.getByText("صفحة المنتجات")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
