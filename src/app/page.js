import Header from "./components/layout/Header";
import Hero from "./components/layout/Hero";
import HomeMenu from "./components/layout/HomeMenu";
import SectionHeaders from "./components/layout/SectionHeaders";

export default function Home() {
  return (
    <>
      <Hero />
      <HomeMenu />

      <section className="text-center my-16">
        <SectionHeaders subHeader={"Our story"} mainHeader={"About us"} />

        <div className="text-gray-500 max-w-md mx-auto mt-4 flex flex-col gap-4">
          <p>
            It is a long established fact that a reader will be distracted by
            the readable content of a page when looking at its layout. The point
            of using Lorem Ipsum is that it has a more-or-less normal distribution
            of letters, as opposed to using &apos;Content here, content here&apos;,
            making it look like readable English.
          </p>

          <p>
            Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots
            in a piece of classical Latin literature from 45 BC, making it over 2000 years old.
            Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia,
            looked up one of the more obscure Latin words, consectetur, from a Lorem Ipsum.
          </p>

          <p>
            Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots
            in a piece of classical Latin literature from 45 BC, making it over 2000 years old.
          </p>
        </div>
      </section>

      <section className="text-center my-8">
        <SectionHeaders subHeader={"Don't hesitate"} mainHeader={"Contact us"} />

        <div className="mt-8">
          <a className="text-4xl underline text-gray-500" href="tel:+09312341232">
            <h1>+09 762 2324</h1>
          </a>
        </div>
      </section>
    </>
  );
}
