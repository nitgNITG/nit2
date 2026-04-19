import Image from "next/image";
import Header from "./components/Header";
import OurServices from "./components/OurServices";
import Sponsors from "./components/Sponsors";
import Experience from "./components/Experience";
import Projects from "./components/Projects";
import Platforms from "./components/Platforms";
import ProjectsCost from "./components/ProjectsCost";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import Location from "./components/Location";
import SocialMedia from "./components/SocialMedia";
import DownSide from "./components/DownSide";
import ServiceCards from "./components/ServiceCards";

export default function Home() {
  return (
    <div className="overflow-y-hidden">
      <Header />
      <OurServices />
      <ServiceCards />
      <Sponsors />
      <Experience />
      <Projects />
      <Platforms />
      <ProjectsCost />
      <Contact key="home-contact" />
      <Location />
      <Footer />
      <SocialMedia />
      <DownSide />
    </div>
  );
}
