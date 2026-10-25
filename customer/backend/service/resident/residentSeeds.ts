import ailanthus from "../../residents/ailanthus.json";
import dogwood from "../../residents/dogwood.json";
import ginkgo from "../../residents/ginkgo.json";
import hawthorn from "../../residents/hawthorn.json";
import hornbeam from "../../residents/hornbeam.json";
import juniper from "../../residents/juniper.json";
import pineterParker from "../../residents/pineter-parker.json";
import sassafras from "../../residents/sassafras.json";
import sycamore from "../../residents/sycamore.json";
import yellowwood from "../../residents/yellowwood.json";

/*
 * Every seed file in `residents/`, bundled into the sync Lambda (§2
 * customer side, decision 2). A test fails if a file there is missing
 * from this list.
 */
export const RESIDENT_SEEDS: unknown[] = [ailanthus, dogwood, ginkgo, hawthorn, hornbeam, juniper, pineterParker, sassafras, sycamore, yellowwood];
