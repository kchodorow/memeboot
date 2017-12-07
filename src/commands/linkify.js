// @flow
import _ from 'lodash';
import assert from 'assert';
import Link from 'models/link';

const HELP = 'help';
const DELETE = 'delete';

class Linkify {
  static COMMAND: string;
  _owner: string;
  _domain: string;
  _response: {};

  constructor(body: {text: string, user_name: string, team_domain: string}) {
    this._owner = body.user_name;
    this._domain = body.team_domain;
    const text = body.text;
    const parts = text.split(' ');
    assert(parts.length > 0);
    switch (parts[0]) {
      case HELP:
        this._response = this.usage();
        break;
      case DELETE:
        this._response = this.delete(parts);
        break;
      default:
      if (parts.length == 2) {
        this._response = this.create(parts);
      } else {
        this._response = this.query(parts[0]);
      }
    }
  }

  getResponse() {
    return this._response;
  }

  usage() {
    return {text: `Create short, memorable aliases for links. Usage:
      Create or update an alias: "${Linkify.COMMAND} _alias_ _url_"
      Use an alias: "${Linkify.COMMAND} _alias_"
      Delete an alias: "${Linkify.COMMAND} delete _alias_"`};
  }

  async delete(parts: Array<string>) {
    if (parts.length < 2) {
      return {
        text: `Nothing to do. "${Linkify.COMMAND} delete _alias_" to delete the _alias_ mapping.`,
      }
    }
    const slug = parts[1];
    return await Link.forge({slug, domain: this._domain}).fetch().then(link => {
      if (!link) {
        return {text: `Link ${slug} not found.`}
      }
      if (link.get('owner') !== this._owner) {
        return {text: `${link.get('owner')} owns ${slug}, you cannot delete it.`};
      }
      link.destroy();
      return {text: `${slug} deleted.`};
    });
  }

  async query(slug: string) {
    const link = await Link.forge({slug, domain: this._domain}).fetch().catch(err => {
      console.log(err);
      return null;
    });
    if (link) {
      return {text: link.get('url')};
    } else {
      return {text: `Short link "${slug}" not found, create it with "${Linkify.COMMAND} ${slug} <url>"`};
    }
  }

  async create(parts: Array<string>) {
    // TODO: verify it just uses URI-valid chars.
    const slug = parts[0];
    const url = parts[1];
    const description = _.join(_.slice(parts, 2, parts.length), ' ');
    const directions = `Type "${Linkify.COMMAND} ${slug}" to use.`;

    const link = Link.forge({slug, domain: this._domain});
    return await link.fetch().then(existing => {
      if (existing) {
        const oldLink = existing.get('url');
        if (existing.get('owner') !== this._owner) {
          return {text: `${slug} already exists, talk to ${link.get('owner')} about editing it.`};
        }
        link.set({url, description});
        link.save();
        return {text: `Updated ${slug} from ${oldLink} to ${link.get('url')}. ${directions}`};
      }
      // Because the unique id is specified, Bookshelf assumes this is an update, not an insert.
      link.set({url, description});
      link.save(null, {method: 'insert'});
      return {text: `Created! ${directions}`}
    }).catch(err => {
      console.log(err);
      return null;
    });
  }
}

Linkify.COMMAND = '/l';

export default Linkify;