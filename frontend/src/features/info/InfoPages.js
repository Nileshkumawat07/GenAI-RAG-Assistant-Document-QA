import React from "react";

import AboutUs from "./AboutUs";
import Careers from "./Careers";
import Contactus from "./Contactus";
import FAQs from "./FAQs";
import Pricing from "./Pricing";

function InfoPages({ page }) {
  if (page === "about") return <AboutUs />;
  if (page === "careers") return <Careers />;
  if (page === "contact") return <Contactus />;
  if (page === "faqs") return <FAQs />;
  return <Pricing />;
}

export default InfoPages;
