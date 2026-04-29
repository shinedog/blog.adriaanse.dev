import React from "react";

const ContactEntry = ({heading, text}) => (
  <div>
    <h4 className="f4 b lh-title mb2 primary">{heading}</h4>
    <p>{text}</p>
  </div>
);

const ContactEntries = ({data}) => data && data.length > 0
  ? (
    <div className="flex-ns mb3">
      {data.map(({heading, text}, i) => <ContactEntry key={i} heading={heading} text={text} />)}
    </div>
  )
  : null;

const ContactPreview = ({entry, getAsset, widgetFor}) => {
  const entryContactEntries = entry.getIn(["data", "contact_entries"]);
  const contactEntries = entryContactEntries ? entryContactEntries.toJS() : [];

  return (
    <div className="ph3 bg-off-white">
      <img src={getAsset(entry.getIn(["data", "logo"]))} alt="" className="db w4 center pv4" />
      <div className="center mw6 pv3">
        {widgetFor("body")}
        <ContactEntries data={contactEntries} />
      </div>
    </div>
  );
};

export default ContactPreview;
