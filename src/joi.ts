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
import * as joi from "@hapi/joi";
import fetch from "node-fetch";

/* types and validators */

// Type and validator for IDs. This is just an alias for the `number` type.
const ID_V = joi.number();
// TODO
// export type ID = t.typeOf<typeof ID_V>;

// Type and validator for properties common to all Hacker News item types
const ItemCommonV = joi.object().keys({
  by: joi.string().required(), // username
  id: ID_V.required(),
  time: joi.number().required(), // seconds since Unix epoch
  dead: joi.boolean(),
  deleted: joi.boolean(),
  kids: joi.array().items(ID_V) // IDs of comments on an item
});

// Type and validator for properties common to stories, job postings, and polls
const TopLevelV = joi.object().keys(
  {
    score: joi.number().required(),
    title: joi.string().required()
  }
);

const StoryV =    joi.object().keys({
      type: joi.valid("story").required(),
      descendants: joi.number().required(), // number of comments
      text: joi.string(), // HTML content if story is a text post
      url: joi.string().uri() // URL of linked article if the story is not text post
    }).concat(
    ItemCommonV).concat(
    TopLevelV);

// export type Story = joi.object().keysOf<typeof StoryV>;

const JobV = 
    joi.object().keys({
      type: joi.valid("job").required(),
      text: joi.string(), // HTML content if job is a text post
      url: joi.string() // URL of linked page if the job is not text post
    }).concat(
    ItemCommonV).concat(
    TopLevelV);
// export type Job = joi.object().keysOf<typeof JobV>;

const PollV = 
    joi.object().keys({
      type: joi.valid("poll").required(),
      descendants: joi.number().required(), // number of comments
      parts: joi.array().items(ID_V)
    }).concat(
    ItemCommonV).concat(
    TopLevelV)
// export type Poll = joi.object().keysOf<typeof PollV>;

const CommentV = 
    joi.object().keys({
      type: joi.valid("comment").required(),
      parent: ID_V.required(),
      text: joi.string().required() // HTML content
    }).concat(
    ItemCommonV);
// export type Comment = joi.object().keysOf<typeof CommentV>;

const PollOptV = joi.object().keys(
  {
    type: joi.valid("pollopt").required(),
    poll: ID_V.required(), // ID of poll that includes this option
    score: joi.number().required(),
    text: joi.string().required() // HTML content
  });
// export type PollOpt = joi.object().keysOf<typeof PollOptV>;

const ItemV = t.taggedUnion(
  "type", // the name of the tag property
  [CommentV, JobV, PollV, PollOptV, StoryV],
  "Item"
);
// type Item = joi.object().keysOf<typeof ItemV>;

/* functions to fetch and display stories and other items */

export async function fetchItem(id: ID): Promise<Item> {
  const res = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`
  );
  const obj = await res.json();
  return decodeToPromise(ItemV, obj);
}

// If you know the type of the item to be fetched use this function with
// a validator for that specific type.
async function fetchItemType<T>(validator: joi.object().keys<T>, id: ID): Promise<T> {
  const res = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`
  );
  const obj = await res.json();
  return decodeToPromise(validator, obj);
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
      return `"${item.title}" submitted by ${item.by} at ${item.time}`;
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
  const ids = await decodeToPromise(t.array(ID_V), await res.json());
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

/* utility functions */

// Apply a validator and get the result in a `Promise`
function decodeToPromise<T, O, I>(
  validator: joi.object().keys<T, O, I>,
  input: I
): Promise<T> {
  const result = validator.decode(input);
  return result.fold(
    errors => {
      const messages = reporter(result);
      return Promise.reject(new Error(messages.join("\n")));
    },
    value => Promise.resolve(value)
  );
}

async function fetchTitle(storyId: number): Promise<string> {
  const res = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${storyId}.json`
  );
  const data = await res.json();

  // If the data that is fetched does not match the `StoryV` validator then this
  // line will result in a rejected promise.
  const story = await decodeToPromise(StoryV, data);

  // This line does not type-check because TypeScript can infer from the
  // definition of `StoryV` that `story` does not have a property called
  // `descendents`.
  // const ds = story.descendents;

  // TypeScript infers that `story` does have a `title` property with a value of
  // type `string`, so this passes type-checking.
  return story.title;
}
