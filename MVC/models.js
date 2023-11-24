const db = require('../db/connection')
const fsPromise = require('fs/promises')

exports.selectAllTopics = () => {
  return db.query('SELECT*FROM topics;').then(({ rows: topics }) => {
    return topics
  })
}

exports.selectEndPoints = () => {
  return fsPromise.readFile(`${__dirname}/../endpoints.json`).then((data) => {
    return JSON.parse(data)
  })
}

exports.selectTopicBySlug = (topic) => {
  return db
    .query('SELECT*FROM topics WHERE slug = $1;', [topic])
    .then(({ rows: [topics] }) => {
      if (!topics) {
        return Promise.reject({ status: 404, msg: 'Not Found' })
      } else return topics
    })
}

exports.selectAllArticles = (topic, sort_by, order, limit, p) => {
  const acceptedSorts = [
    'author',
    'title',
    'article_id',
    'topic',
    'created_at',
    'votes',
    'article_img_url',
    'comment_count',
  ]
  if (sort_by && !acceptedSorts.includes(sort_by)) {
    return Promise.reject({ status: 400, msg: 'Bad Request' })
  }
  if (order !== 'ASC' && order !== 'DESC' && order) {
    return Promise.reject({ status: 400, msg: 'Bad Request' })
  }
  if (limit > 50) {
    return Promise.reject({
      status: 400,
      msg: 'Bad Request - limit too high max 50',
    })
  }

  let selectArray = undefined
  let selectString = `SELECT 
  articles.article_id,
  articles.title,
  articles.topic,
  articles.author,
  articles.created_at,
  articles.votes,
  article_img_url,
  COUNT(comment_id) AS comment_count
  FROM articles
  LEFT JOIN comments ON articles.article_id=comments.article_id`

  let defaultgroup = ` GROUP BY articles.article_id `
  let defaultSort = ` ORDER BY created_at DESC`
  let defaultLimit = ` LIMIT 10;`

  if (topic) {
    selectArray = [`${topic}`]
    selectString =
      selectString + ' WHERE articles.topic = $1' + defaultgroup + defaultSort
  } else if (sort_by) {
    selectString += defaultgroup += ` ORDER BY ${sort_by} DESC;`
  } else if (order === 'ASC') {
    selectString += defaultgroup += ` ORDER BY created_at ${order};`
  } else if (limit) {
    selectArray = [limit]
    selectString += defaultgroup += defaultSort + ` lIMIT $1;`
  } else if (p) {
    selectArray = [p - 1]
    selectString += defaultgroup += defaultSort + ` LIMIT 10 OFFSET 10*$1`
  } else {
    selectString += defaultgroup += defaultSort += defaultLimit
  }
  return db.query(selectString, selectArray).then(({ rows }) => {
    return rows
  })
}

exports.totalArticleCount = (p) => {
  return db
    .query(`SELECT COUNT(*) AS total_count FROM articles`)
    .then(({ rows: [count] }) => {
      count.total_count = Number(count.total_count)
      if (count.total_count / 10 < p - 1) {
        return Promise.reject({ status: 400, msg: 'Bad Request' })
      } else return count
    })
}

exports.selectArticleById = (id) => {
  return db
    .query(
      `SELECT 
    articles.*,
    COUNT(comment_id) AS comment_count
    FROM articles 
    LEFT JOIN comments ON articles.article_id=comments.article_id 
    WHERE articles.article_id = $1
    GROUP BY articles.article_id;`,
      [id]
    )
    .then(({ rows: [article] }) => {
      if (article) {
        article.comment_count = Number(article.comment_count)
      } else if (!article) {
        return Promise.reject({ status: 404, msg: 'Not Found' })
      }
      return article
    })
}

exports.selectCommentsByArticleId = (id, limit, p) => {
  let selectString = 'SELECT*FROM comments WHERE article_id = $1'
  let selectArray = [id]
  let defaultOrder = ` ORDER BY created_at ASC`
  let defaultLimit = ` LIMIT 10;`
  if (limit > 50) {
    return Promise.reject({
      status: 400,
      msg: 'Bad Request - limit too high max 50',
    })
  }
  if (limit) {
    selectArray.push(limit)
    selectString += defaultOrder += ` LIMIT $2;`
  } else if (p) {
    selectArray.push(p - 1)
    selectString += defaultOrder += ` LIMIT 10 OFFSET 10*$2;`
  } else {
    selectString += defaultOrder += defaultLimit
  }
  return db.query(selectString, selectArray).then(({ rows: comments }) => {
    if (comments.length === 0 && p > 1) {
      return Promise.reject({ status: 400, msg: 'Bad Request' })
    } else return comments
  })
}

exports.addCommentToArticleById = (id, { body, username }) => {
  return db
    .query(
      'INSERT INTO comments ( article_id, author, body) VALUES ($1,$2,$3) RETURNING*;',
      [id, username, body]
    )
    .then(({ rows }) => {
      return rows
    })
}

exports.deleteOneComment = (id) => {
  return db.query('DELETE FROM comments WHERE comment_id = $1;', [id])
}

exports.selectAllComments = () => {
  return db.query('SELECT*FROM comments;').then(({ rows: comments }) => {
    return comments
  })
}

exports.selectCommentById = (id) => {
  return db
    .query('SELECT*FROM comments WHERE comment_id = $1;', [id])
    .then(({ rows: [comments] }) => {
      if (!comments) {
        return Promise.reject({ status: 404, msg: 'Not Found' })
      } else return comments
    })
}

exports.selectAllUsers = () => {
  return db.query('SELECT*FROM users;').then(({ rows: users }) => {
    return users
  })
}

exports.selectUsername = (username) => {
  return db
    .query('SELECT*FROM users WHERE username = $1;', [username])
    .then(({ rows: [username] }) => {
      if (!username) {
        return Promise.reject({ status: 404, msg: 'Not Found' })
      } else return username
    })
}

exports.incArticleVotesById = (id, inc) => {
  return db
    .query(
      'UPDATE articles SET votes = votes + $2 WHERE article_id = $1 RETURNING*;',
      [id, inc]
    )
    .then(({ rows: article }) => {
      return article
    })
}

exports.incCommentVotesById = (id, inc) => {
  return db
    .query(
      'UPDATE comments SET votes = votes + $2 WHERE comment_id = $1 RETURNING*;',
      [id, inc]
    )
    .then(({ rows: comment }) => {
      return comment
    })
}

exports.postArticletoArticles = (articlePost) => {
  const { author, title, body, topic } = articlePost
  return db
    .query(
      'INSERT INTO articles (author, title,body,topic) VALUES ($1,$2,$3,$4) RETURNING articles.article_id;',
      [author, title, body, topic]
    )
    .then(({ rows: [{ article_id }] }) => {
      return article_id
    })
}

exports.postTopic = (topicToPost) => {
  const { slug, description} = topicToPost
  if(!slug || !description){
    return Promise.reject({ status: 400, msg: 'Bad Request' })
  }

  return db
  .query(
    'INSERT INTO topics (slug, description) VALUES ($1,$2) RETURNING *;',
    [slug, description]
  )
  .then(({ rows:[topic] }) => {
    return topic
  })
}
