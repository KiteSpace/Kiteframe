import { Link, Redirect, Route, Switch } from "wouter";
import { Button } from "@/components/ui/button";
import { CoffeeLayout } from "@/coffee/components/CoffeeLayout";
import CoffeeMap from "@/pages/CoffeeMap";
import CoffeeCatalogue from "@/pages/CoffeeCatalogue";
import CoffeeShopDetail from "@/pages/CoffeeShopDetail";
import CoffeeJournal from "@/pages/CoffeeJournal";
import CoffeeJournalPost from "@/pages/CoffeeJournalPost";

export default function App() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/map" />
      </Route>
      <Route path="/map" component={CoffeeMap} />
      <Route path="/grid" component={CoffeeCatalogue} />
      <Route path="/shops/:slug" component={CoffeeShopDetail} />
      <Route path="/journal" component={CoffeeJournal} />
      <Route path="/journal/:slug" component={CoffeeJournalPost} />
      <Route>
        <CoffeeLayout>
          <div className="mx-auto max-w-md px-6 py-24 text-center">
            <h1 className="coffee-display text-4xl">Not found</h1>
            <p className="mt-3 text-muted-foreground">
              That page is not in the atlas.
            </p>
            <Button asChild className="mt-6">
              <Link href="/map">Back to the map</Link>
            </Button>
          </div>
        </CoffeeLayout>
      </Route>
    </Switch>
  );
}
