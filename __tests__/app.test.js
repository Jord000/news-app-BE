const app = require('../MVC/app.js');
const seed = require('../db/seeds/seed.js');
const request = require('supertest');
const db = require('../db/connection.js');
const {
  userData,
  topicData,
  commentData,
  articleData,
} = require('../db/data/test-data/index.js');
const endpointFile = require('../endpoints.json');
const jestSorted = require('jest-sorted');

afterAll(() => {
  db.end();
});

beforeEach(() => {
  return seed({ topicData, userData, articleData, commentData });
});

describe('GET:200 /api/healthcheck', () => {
  test('makes correct 200 connection on a basic endpoint to check the health of the API', () => {
    return request(app).get('/api/healthcheck').expect(200);
  });
});

describe('GET:200 /api/topics', () => {
  test('endpoint returns all topics as an array with slug and description', () => {
    return request(app)
      .get('/api/topics')
      .expect(200)
      .then(({ body: { topics } }) => {
        expect(topics.length).toEqual(topicData.length);
        topics.forEach((topic) => {
          expect(topic).toHaveProperty('description');
          expect(topic).toHaveProperty('slug');
        });
      });
  });
  test('provides error for incorrect api path spelling', () => {
    return request(app)
      .get('/api/topicsincorrect')
      .expect(404)
      .then((response) => {
        expect(response.body.msg).toBe('incorrect path - path not found');
      });
  });
});

describe('GET:200 /api', () => {
  test('should respond with an object containing all endpoints', () => {
    return request(app)
      .get('/api')
      .expect(200)
      .then(({ body: { data } }) => {
        expect(data).toMatchObject(endpointFile);
      });
  });
});

describe('GET:200 /GET/api/articles/:article_id', () => {
  test('should respond with an object matching the correct article id entry', () => {
    return request(app)
      .get('/api/articles/5')
      .expect(200)
      .then(({ body: article }) => {
        expect(article).toMatchObject({
          article5: {
            article_id: 5,
            title: 'UNCOVERED: catspiracy to bring down democracy',
            topic: 'cats',
            author: 'rogersop',
            body: 'Bastet walks amongst us, and the cats are taking arms!',
            article_img_url:
              'https://images.pexels.com/photos/158651/news-newsletter-newspaper-information-158651.jpeg?w=700&h=700',
          },
        });
      });
  });
  test('should return correct error when wrong article_id provided', () => {
    return request(app)
      .get('/api/articles/999999999999')
      .expect(400)
      .then(({ body }) => {
        expect(body.msg).toBe('Bad Request - outside range');
      });
  });
  test('should return correct error when wrong article_id provided', () => {
    return request(app)
      .get('/api/articles/99')
      .expect(404)
      .then(({ body }) => {
        expect(body.msg).toBe('Not Found');
      });
  });
  test('should handle bad requests', () => {
    return request(app)
      .get('/api/articles/whoopsie')
      .expect(400)
      .then(({ body }) => {
        expect(body.msg).toBe('Bad Request');
      });
  });
});

describe('GET:200 /api/articles', () => {
  test('should return all articles with the correct properties', () => {
    const correctProperties = [
      'author',
      'title',
      'article_id',
      'topic',
      'created_at',
      'votes',
      'article_img_url',
      'comment_count',
    ];
    return request(app)
      .get('/api/articles')
      .expect(200)
      .then(({ body: { articles } }) => {
        expect(articles.length).toBe(articleData.length);
        articles.forEach((article) => {
          expect(Object.keys(article)).toEqual(
            expect.arrayContaining(correctProperties)
          );
          expect(article).toMatchObject({
            author: expect.any(String),
            title: expect.any(String),
            topic: expect.any(String),
            created_at: expect.any(String),
            votes: expect.any(Number),
          });
          expect(article).not.toHaveProperty('body');
          expect(article.article_img_url).toMatch(new RegExp('^https:?'));
        });
        expect(articles).toBeSortedBy('created_at', { descending: true });
      });
  });
});
describe('GET: /api/articles/:article_id/comments', () => {
  test('should provide all comments for an article by its Id', () => {
    const testFilter = commentData.filter(
      (comment) => comment.article_id === 3
    );
    return request(app)
      .get('/api/articles/3/comments')
      .expect(200)
      .then(({ body: { comments } }) => {
        expect(comments.length).toBe(testFilter.length);
        comments.forEach((comment) => {
          expect(comment).toMatchObject({
            comment_id: expect.any(Number),
            votes: expect.any(Number),
            created_at: expect.any(String),
            author: expect.any(String),
            body: expect.any(String),
            article_id: 3,
          });
        });
        expect(comments).toBeSortedBy('created_at', { descending: false });
      });
  });
  test('should handle non-existant ID request', () => {
    return request(app)
      .get('/api/articles/99/comments')
      .expect(404)
      .then(({ body }) => {
        expect(body.msg).toBe('Not Found');
      });
  });
  test('should handle non-existant comments request', () => {
    return request(app)
      .get('/api/articles/2/comments')
      .expect(200)
      .then(({ body }) => {
        expect(body).toEqual({ comments: [] });
      });
  });
  test('should handle incorrect id entry', () => {
    return request(app)
      .get('/api/articles/incorrect/comments')
      .expect(400)
      .then(({ body }) => {
        expect(body.msg).toBe('Bad Request');
      });
  });
});

describe('POST /api/articles/:article_id/comments', () => {
  const postObj = {
    username: 'butter_bridge',
    body: 'this is a test comment to add to article 2',
  };
  const wrongPost1 = {
    username: 'thisIsNotAUser',
    body: 'this is a test comment',
  };
  const wrongPost2 = {
    username: 'butter_bridge',
  };
  test('should allow posting of a comment to an article by its id', () => {
    return request(app)
      .post('/api/articles/2/comments')
      .send(postObj)
      .expect(201)
      .then(({ body: { comment } }) => {
        expect(comment).toMatchObject({
          comment_id: 19,
          author: 'butter_bridge',
          body: 'this is a test comment to add to article 2',
          article_id: 2,
          created_at: expect.any(String),
          votes: 0,
        });
      });
  });
  test('should return correct error when wrong article_id provided', () => {
    return request(app)
      .post('/api/articles/99/comments')
      .send(postObj)
      .expect(404)
      .then(({ body }) => {
        expect(body.msg).toBe('Not Found');
      });
  });
  test('should handle bad requests', () => {
    return request(app)
      .post('/api/articles/noarticleid/comments')
      .send(postObj)
      .expect(400)
      .then(({ body }) => {
        expect(body.msg).toBe('Bad Request');
      });
  });
  test('should send correct error back when user not found', () => {
    return request(app)
      .post('/api/articles/2/comments')
      .send(wrongPost1)
      .expect(404)
      .then(({ body }) => {
        expect(body.msg).toBe('Not Found');
      });
  });
  test('should send error when body not included', () => {
    return request(app)
      .post('/api/articles/2/comments')
      .send(wrongPost2)
      .expect(400)
      .then(({ body }) => {
        expect(body.msg).toBe('Bad Request');
      });
  });
});

describe('GET /api/users', () => {
  test('should return all users on an object of users', () => {
    return request(app)
      .get('/api/users')
      .expect(200)
      .then(({ body: { users } }) => {
        users.forEach((user) => {
          expect(user).toMatchObject({
            username: expect.any(String),
            name: expect.any(String),
            avatar_url: expect.any(String),
          });
          expect(user.avatar_url).toMatch(new RegExp('^https:?'))
        });
      });
  });
});
