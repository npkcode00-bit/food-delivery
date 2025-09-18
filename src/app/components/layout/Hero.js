import Right from "../icons/Right";

export default function Hero() {
  return (
    <section className="hero mt-4">
      <div className="py-4">
        <h1 className="text-4xl font-semibold">
          Everything <br />
          is better <br />
          with a&nbsp;
          <span className="text-primary">Pizza</span>
        </h1>

        <p className="my-6 text-gray-500 text-sm">
          <q>
            Neque porro quisquam est qui dolorem ipsum quia dolor sit amet,
            consectetur, adipisci velit...
          </q>{" "}
          <q>
            There is no one who loves pain itself, who seeks after it and wants
            to have it, simply because it is pain...
          </q>
        </p>

        <div className="flex gap-4 text-sm">
          <button
            type="button"
            className="flex items-center gap-2 px-8 py-2 rounded-full bg-primary text-white uppercase"
          >
            Order now
            <Right />
          </button>
          <button
            type="button"
            className="flex items-center gap-2 py-2 font-semibold text-gray-600"
          >
            Learn more
            <Right />
          </button>
        </div>
      </div>

      <div className="relative">
        <img src="/pizza.png" alt="Slice of pizza" />
      </div>
    </section>
  );
}
