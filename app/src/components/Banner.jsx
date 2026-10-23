import { DISCLAIMER_TEXT } from "../config.js";

// Always visible on every screen.
export default function Banner() {
  return (
    <div className="banner" role="note">
      <span>{DISCLAIMER_TEXT}</span> <strong className="banner-112">112</strong>
    </div>
  );
}
