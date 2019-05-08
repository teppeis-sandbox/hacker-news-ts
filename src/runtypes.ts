/*
 * This is a demonstration of type checking with TypeScript. This example is
 * a Hacker News client.
 *
 * This module may be imported as a library. If run directly it will use some
 * very simple code to print out recent story titles to the command line.
 *
 * Take a look at the accompanying blog post:
 * http://www.olioapps.com/blog/checking-types-against-the-real-world-in-typescript/
 */
import * as r from "runtypes";
import fetch from "node-fetch";

/* types and validators */

// Type and validator for IDs. This is just an alias for the `number` type.
const ID_V = r.Number;
export type ID = r.Static<typeof ID_V>;

// Type and validator for properties common to all Hacker News item types
const ItemCommonV = r
  .Record({
    by: r.String, // username
    id: ID_V,
    time: r.Number // seconds since Unix epoch
  })
  .And(
    r.Partial({
      dead: r.Boolean,
      deleted: r.Boolean,
      kids: r.Array(ID_V) // IDs of comments on an item
    })
  );

// Type and validator for properties common to stories, job postings, and polls
const TopLevelV = r.Record({
  score: r.Number,
  title: r.String
});

const StoryV = r
  .Record({
    type: r.Literal("story"),
    descendants: r.Number // number of comments
  })
  .And(
    r.Partial({
      text: r.String, // HTML content if story is a text post
      url: r.String // URL of linked article if the story is not text post
    })
  )
  .And(ItemCommonV)
  .And(TopLevelV);
export type Story = r.Static<typeof StoryV>;

const JobV = r
  .Record({
    type: r.Literal("job")
  })
  .And(
    r.Partial({
      text: r.String, // HTML content if job is a text post
      url: r.String // URL of linked page if the job is not text post
    })
  )
  .And(ItemCommonV)
  .And(TopLevelV);
export type Job = r.Static<typeof JobV>;

const PollV = r
  .Record({
    type: r.Literal("poll"),
    descendants: r.Number, // number of comments
    parts: r.Array(ID_V)
  })
  .And(ItemCommonV)
  .And(TopLevelV);
export type Poll = r.Static<typeof PollV>;

const CommentV = r
  .Record({
    type: r.Literal("comment"),
    parent: ID_V,
    text: r.String // HTML content
  })
  .And(ItemCommonV);
export type Comment = r.Static<typeof CommentV>;

const PollOptV = r.Record({
  type: r.Literal("pollopt"),
  poll: ID_V, // ID of poll that includes this option
  score: r.Number,
  text: r.String // HTML content
});
export type PollOpt = r.Static<typeof PollOptV>;

// "type": the name of the tag property
const ItemV = r.Union(CommentV, JobV, PollV, PollOptV, StoryV);
type Item = r.Static<typeof ItemV>;

/* functions to fetch and display stories and other items */

export async function fetchItem(id: ID): Promise<Item> {
  const res = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`
  );
  const obj = await res.json();
  return ItemV.check(obj);
}

// If you know the type of the item to be fetched use this function with
// a validator for that specific type.
async function fetchItemType<T extends Item>(
  validator: r.Runtype<T>,
  id: ID
): Promise<T> {
  const res = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`
  );
  const obj = await res.json();
  return validator.check(obj);
}

function getTitle(item: Item): string | undefined {
  if (item.type === "story") {
    // This works because this line is only reachable if the type of
    // `item.type` is `'story'`, which means that `item` can be expected to
    // have a `title` property.
    return item.title;
  }
}

function formatStory(story: Story): string {
  return `"${story.title}" submitted by ${story.by}`;
}

function formatItem(item: Item): string {
  switch (item.type) {
    case "story":
      return `"${item.title}" submitted by ${item.by}`;
    case "job":
      return `job posting: ${item.title}`;
    case "poll":
      const numOpts = item.parts.length;
      return `poll: "${item.title}" - choose one of ${numOpts} options`;
    case "pollopt":
      return `poll option: ${item.text}`;
    case "comment":
      const excerpt =
        item.text.length > 60 ? item.text.slice(0, 60) + "..." : item.text;
      return `${item.by} commented: ${excerpt}`;
    default:
      throw new Error();
  }
}

// Fetch up to 500 of the top stories, jobs, or polls
export async function fetchTopStories(count: number): Promise<Item[]> {
  const res = await fetch(
    "https://hacker-news.firebaseio.com/v0/topstories.json"
  );
  const ids = r.Array(ID_V).check(await res.json());
  return Promise.all(ids.slice(0, count).map(id => fetchItem(id)));
}

/* a very basic client */

export async function main() {
  try {
    const stories = await fetchTopStories(15);
    for (const story of stories) {
      console.log(formatItem(story) + "\n");
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
if (require.main === module) {
  main();
}

async function fetchTitle(storyId: number): Promise<string> {
  const res = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${storyId}.json`
  );
  const data = await res.json();

  // If the data that is fetched does not match the `StoryV` validator then this
  // line will result in a rejected promise.
  const story = StoryV.check(data);

  // This line does not type-check because TypeScript can infer from the
  // definition of `StoryV` that `story` does not have a property called
  // `descendents`.
  // const ds = story.descendents;

  // TypeScript infers that `story` does have a `title` property with a value of
  // type `string`, so this passes type-checking.
  return story.title;
}
