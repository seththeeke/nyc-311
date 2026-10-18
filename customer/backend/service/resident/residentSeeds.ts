import hawthorn from "../../residents/hawthorn.json";
import juniper from "../../residents/juniper.json";
import sycamore from "../../residents/sycamore.json";

/*
 * Every seed file in `residents/`, bundled into the sync Lambda (§2
 * customer side, decision 2). A test fails if a file there is missing
 * from this list.
 */
export const RESIDENT_SEEDS: unknown[] = [hawthorn, juniper, sycamore];
