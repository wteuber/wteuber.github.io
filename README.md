# My blog
https://wteuber.com

## Github repository
https://github.com/wteuber/wteuber.github.io

### Serve my blog locally

```sh
bundle exec jekyll serve -l
```

### Generate directory browser boilerplate HTLM

e.g. for public/
```sh
ruby -run -e httpd . -p 3000
curl http://127.0.0.1:3000/public/ > /tmp/wtghio.tmp
mv /tmp/wtghio.tmp public/index.html
```

### Convert Scratch projects to JavaScript

```sh
sb-edit --input path/to/project.sb3 --output path/to/output-folder
```
FMI, see https://github.com/leopard-js/sb-edit
https://leopardjs.com/


### Turn text into dashed file name
```sh
echo "This is: Text!" | tr -sc '[:alnum:]' ' ' | tr '[:upper:]' '[:lower:]' | xargs | tr ' ' '-'
```
=>
```
this-is-text
```

### Improve blog post quality using an AI Expert Panel Discussion
```
# The Blog Post Podium: Expert Panel Review and Coaching Role Play
I am attending an exclusive panel discussion featuring four renowned blog post gurus: Steve Rayson, Seth Godin, Neil Patel, and Jeff Bullas. The purpose is to analyze, critique, and enhance my latest blog post. As the session unfolds, the experts will discuss these areas:
- Blog post structure
- Content quality and relevance
- Engagement metrics (comments, time on page, bounce rate)
- Shareability (social shares, inbound links)
- Performance metrics (traffic sources, conversions)
- Contextual fit for my target audience

Each expert brings their own specialty:
- Steve Rayson: Data-driven review of headlines, structure, and shareability
- Seth Godin: Differentiation, thought leadership, and authenticity
- Neil Patel: SEO, actionable value, and traffic growth
- Jeff Bullas: Consistency, engagement tactics, and digital influence

Scenario
The conversation begins with Steve Rayson outlining initial observations based on headline metrics, content layout, and shareability potential. Seth Godin then explores how my post stands out and delivers value to my audience. Neil Patel dives into the SEO and conversion strategy embedded in my content. Jeff Bullas discusses ways to drive engagement and digital influence. Include real-world facts and references the blog experts are most likely to use.

They will:
- Discuss among themselves, comparing observations and debating strengths and weaknesses.
- Pose clarifying and deepening questions to me about my intent, target audience, and business goals.
- Focus on metrics such as organic traffic, social shares, time on page, conversion rate, and inbound links.​
- Provide practical, actionable feedback and recommend improvements grounded in industry standards and best practices.​
- Be silent if they don't see a way to add value

My Role
I will respond to their questions, provide additional context, and share my goals for the blog post. The discussion pauses for my input whenever a panelist asks a clarifying question. After each round of feedback, I can update my blog post or supply more information as requested.

Example Dialogue Opening:

Steve Rayson: "Based on your headline and structure, here are some data-driven strengths and opportunities for improvement. How did you decide on your primary headline, and what audience are you targeting with this post?"

(Seth Godin waits and, after my reply, continues...)

Seth Godin: "Does this post reflect your unique perspective? What was your central motivation behind writing it, and how do you want your readers to feel after reading?"

(Neil Patel steps in after my input...)

Neil Patel: "From an SEO and conversion perspective, do you have specific keywords or call-to-action goals in mind? How do you track post effectiveness currently?"

(Jeff Bullas joins after my response...)

Jeff Bullas: "How do you encourage readers to comment and share your post? What engagement strategies have worked for you in the past, and what would you like to see improve?"

Panelists continue to discuss my answers, challenge each other's viewpoints, and suggest refinements. Each time a deeper insight or clarification is needed, the conversation halts for my reply before proceeding further. The session ends when they have provided holistic, metric-driven recommendations and I am satisfied with the improvements.

Blog Post Draft:
[My initial blog post goes here]
```

[the conversation]

```
Thank you! The Panel Discussion and the Roleplay is over now. Use the Expert Panel Discussion's clarifications and insights to improve the Blog Post Draft. Answer with the improved version of the blog post only.
```
