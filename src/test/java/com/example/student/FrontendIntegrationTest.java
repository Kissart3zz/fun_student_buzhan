package com.example.student;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import java.net.URI;
import java.net.http.*;
import java.util.regex.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class FrontendIntegrationTest {
 @LocalServerPort int port;
 final HttpClient client=HttpClient.newHttpClient();
 HttpResponse<String> request(String method,String path,String token,String body) throws Exception {
  var b=HttpRequest.newBuilder(URI.create("http://localhost:"+port+path));
  if(token!=null)b.header("Authorization","Bearer "+token);
  if(body!=null)b.header("Content-Type","application/json");
  return client.send(b.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
 }
 String field(String json,String field){var m=Pattern.compile("\""+field+"\"\\s*:\\s*\"([^\"]+)\"").matcher(json);assertTrue(m.find(),json);return m.group(1);}
 String id(String json){var m=Pattern.compile("\"id\"\\s*:\\s*(\\d+)").matcher(json);assertTrue(m.find(),json);return m.group(1);}
 String login(String email,String password)throws Exception{var r=request("POST","/api/v1/auth/login",null,"{\"email\":\""+email+"\",\"password\":\""+password+"\"}");assertEquals(200,r.statusCode(),r.body());return field(r.body(),"token");}
 @Test void completeWorkflow()throws Exception{
  for(String p:new String[]{"/","/index.html","/app.js","/style.css"})assertEquals(200,request("GET",p,null,null).statusCode(),p);
  assertEquals(401,request("GET","/api/v1/student",null,null).statusCode());
  assertTrue(request("POST","/api/v1/auth/login",null,"{\"email\":\"admin@example.com\",\"password\":\"wrong\"}").statusCode()>=400);
  String admin=login("admin@example.com","admin"),teacher=login("teacher@example.com","teacher"),superadmin=login("superadmin@example.com","superAdmin");
  assertEquals(200,request("GET","/api/v1/student",teacher,null).statusCode());
  assertEquals(403,request("POST","/api/v1/student/save",teacher,"{}").statusCode());
  var created=request("POST","/api/v1/student/save",admin,"{\"name\":\"Test\",\"surname\":\"Student\",\"phone_number\":\"123\",\"email\":\"test@example.com\"}");assertEquals(200,created.statusCode(),created.body());String sid=id(created.body());
  var info=request("GET","/api/v1/student/"+sid,teacher,null);assertTrue(info.body().contains("123"));
  assertEquals(200,request("PUT","/api/v1/student/"+sid,admin,"{\"phoneNumber\":\"456\",\"email\":\"changed@example.com\"}").statusCode());
  assertTrue(request("GET","/api/v1/student/info/"+sid,admin,null).body().contains("456"));
  assertEquals(200,request("DELETE","/api/v1/student/"+sid,admin,null).statusCode());
  assertEquals(404,request("GET","/api/v1/student/"+sid,admin,null).statusCode());
  assertEquals(403,request("GET","/api/v1/users",admin,null).statusCode());
  assertEquals(200,request("GET","/api/v1/users",superadmin,null).statusCode());
  var user=request("POST","/api/v1/users/save",superadmin,"{\"email\":\"new@example.com\",\"password\":\"test123\",\"roles\":[\"TEACHER\"]}");assertEquals(200,user.statusCode(),user.body());String uid=id(user.body());
  login("new@example.com","test123");
  var updated=request("PUT","/api/v1/users/"+uid,superadmin,"{\"email\":\"updated@example.com\",\"password\":\"new123\",\"roles\":[\"ADMIN\"]}");assertEquals(200,updated.statusCode(),updated.body());assertTrue(updated.body().contains("updated@example.com"));login("updated@example.com","new123");
  assertEquals(200,request("DELETE","/api/v1/users/"+uid,superadmin,null).statusCode());
  assertEquals(401,request("GET","/api/v1/student","invalid",null).statusCode());
 }
}
