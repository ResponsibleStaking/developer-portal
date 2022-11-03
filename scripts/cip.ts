import * as fs from "fs";
import * as path from "path";
import {
  getStringContentAsync,
  getBufferContentAsync,
  preventH1Headline,
} from "./reusable";
import {
  CIPRepoRawBaseUrl,
  CIPReadmeUrl,
  CIPPReadmeRegex,
  CIPRegex,
  CIPDocsPath,
  CIPStaticResourcePath,
  CIPSourceRepo,
  CIPRepoBaseUrl
} from "./constants";

// Current pathname
const pathName = path.basename(__filename);

// Download markdown resources
const processCIPContentAsync = async (cipName: string, content: string) => {
  const cipResources = content.match(CIPRegex);
  if (cipResources) {
    await Promise.all(
      cipResources.map(async (r) => {
        if (r.indexOf("http://") < 0 && r.indexOf("https://") < 0) {
          // create filenames to download into static folder
          const fileName = r
            .replace("](", "")
            .replace(".png)", ".png")
            .replace(".jpg)", ".jpg")
            .replace(".jpeg)", ".jpeg")
            .replace(".json)", ".json");

          // Create modified filenames in case we want to store files
          // with a different ending, like JSON files
          const modifiedFileName = r
            .replace("](", "")
            .replace(".png)", ".png")
            .replace(".jpg)", ".jpg")
            .replace(".jpeg)", ".jpeg")
            .replace(".json)", ".txt");

          const buffer = await getBufferContentAsync(
            `${CIPRepoRawBaseUrl}${cipName}/${fileName}`
          );

          if (fs.existsSync(`.${CIPStaticResourcePath}${cipName}`)) {
            fs.rmSync(`.${CIPStaticResourcePath}${cipName}`, {
              recursive: true,
            });
          }
          fs.mkdirSync(`.${CIPStaticResourcePath}${cipName}`, {
            recursive: true,
          });

          fs.writeFileSync(
            `.${CIPStaticResourcePath}${cipName}/${modifiedFileName}`,
            new Uint8Array(buffer)
          );

          // Rewrite link to static folder
          content = content.replace(
            fileName,
            `../../..${CIPStaticResourcePath}${cipName}/${modifiedFileName}`
          );
          console.log(
            `Processed CIP content downloaded to .${CIPStaticResourcePath}${cipName}/${fileName}`
          );
        }
      })
    );
  }

  // Ensure compatibility
  content = stringManipulation(content, cipName);

  return content;
};

// Clear up this is auto generated file from CIP repository
const injectAutogeneratedMessage = (content: string, fileName: string, path: string) => {
  
  const status = getDocTag(content, "Status");
  const type = getDocTag(content, "Type");
  const creationDate = getDocTag(content, "Created");

  return (
    content +
    "\n" +
    "## CIP Information  \nThis [" +
    type +
    "](CIP-0001#cip-format-and-structure) " +
    fileName +
    " created on **" +
    creationDate +
    "** has the status: [" +
    status +
    "](CIP-0001#cip-workflow).  \nThis page was generated automatically from: [" +
    CIPSourceRepo +
    "](" +
    CIPRepoBaseUrl +
    fileName +
    CIPReadmeUrl +
    ")."
  );
}

// Inject Docusaurus doc tags for title and add a nice sidebar
const injectDocusaurusDocTags = (content: string) => {

    // Remove '---' from doc to add it later
    content = content.substring(0, 3) === "---" ? content.slice(3) : content;

    // Parse information from markdown file
    const title = getDocTag(content, "Title");
    const cipNumber = getDocTag(content, "CIP");

    // Add "---" with doc tags for Docusaurus
    content =
      "--- \nsidebar_label: " + "(" + cipNumber + ") " + title + content;

    // Temporary solution!
    // CIP script needs to be rebuild, currently CIP 49 has useless information in header that will be removed in the future
    content = content.replace('* License: \n* License-Code:\n* Post-History:\n* Requires:\n* Replaces:\n* Superseded-By:\n', '')

    return content;
}

// String manipulations to ensure compatibility
const stringManipulation = (content: string, cipName: string) => {
  // We expect markdown files, therefore strip HTML
  content = content.replace(/(<([^>]+)>)/gi, "");

  // Rewrite relative links like [Byron](./Byron.md) to absolute links.
  content = content.replace(
    /\]\(\.\//gm,
    "](" + CIPRepoRawBaseUrl + cipName + "/"
  );

  // Fix parent links to CIPs
  content = content.replace(/]\(\..\/CIP-/gm, "](./CIP-");

  // Remove invalid "CIP-YET-TO-COME" links that are empty
  content = content.replace("]()", "]");

  // Remove unterminated string constant like in CIP 30
  content = content.replace(/\\/g, "");

  // Prevent H1 headlines
  content = preventH1Headline(content, "Abstract");
  content = preventH1Headline(content, "Motivation");
  content = preventH1Headline(content, "Specification");
  content = preventH1Headline(content, "Rationale");
  content = preventH1Headline(content, "Copyright");

  // Inject Docusaurus doc tags for title and add a nice sidebar

  content = injectDocusaurusDocTags(content);

  // Clear up this is auto generated file from CIP repository
  content = injectAutogeneratedMessage(content, cipName, pathName);

  // Temporary solution!
  // Fix for CIP 60
  // Replace link to actual file on github. (Fix asap, when taking care of scripts)
  content = content.replace('cddl/version-1.cddl', 'https://github.com/cardano-foundation/CIPs/blob/master/CIP-0060/cddl/version-1.cddl');
  
  return content;
};

// Get a specific doc tag
const getDocTag = (content: string, tagName: string) => {
  return content.match(new RegExp(`(?<=${tagName}: ).*`, ""));
};

const main = async () => {
  console.log("CIP Content Downloading...");
  // Use https://raw.githubusercontent.com/cardano-foundation/CIPs/master/README.md as entry point to get URLs
  const readmeContent = await getStringContentAsync(
    `${CIPRepoRawBaseUrl}${CIPReadmeUrl}`
  );
  const cipUrls = readmeContent.match(CIPPReadmeRegex);
  const cipUrlsUnique = [...new Set(cipUrls)];

  if (fs.existsSync(CIPDocsPath)) {
    fs.rmSync(CIPDocsPath, { recursive: true });
  }
  fs.mkdirSync(CIPDocsPath, { recursive: true });

  // Save CIP Readme into docs
  await Promise.all(
    cipUrlsUnique.map(async (cipUrl) => {
      const fileName: string = "README.md";
      const cipName: string = cipUrl.slice(0, -1)

      let content = await getStringContentAsync(
        CIPRepoRawBaseUrl + '/' + cipName + '/' + fileName
      );
      content = await processCIPContentAsync(cipName, content);

      fs.writeFileSync(`${CIPDocsPath}/${cipName}.md`, content);
      console.log(`Downloaded to ${CIPDocsPath}/${cipName}.md`);
    })
  );

  console.log("CIP Content Downloaded");
};

main();
