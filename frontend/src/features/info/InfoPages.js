import React from "react";

import AboutUs from "./AboutUs";
import Careers from "./Careers";
import Contactus from "./Contactus";
import FAQs from "./FAQs";
import HelpCenter from "./HelpCenter";
import Pricing from "./Pricing";
import TrustCenter from "./TrustCenter";

function InfoPages({ page }) {
  if (page === "about") return <AboutUs />;
  if (page === "careers") return <Careers />;
  if (page === "contact") return <Contactus />;
  if (page === "faqs") return <FAQs />;
  if (page === "help") return <HelpCenter />;
  if (page === "trust") return <TrustCenter />;
  return <Pricing />;
}

export default InfoPages;
